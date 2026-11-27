const TAB_NAME = "Respostas";
const SPREADSHEET_PROPERTY = "SURVEY_SPREADSHEET_ID";
const HEADERS = [
  "ID", "Data do envio", "Nome da cooperativa", "Email de contacto",
  "Propriedade coletiva", "Propriedade individual", "Ano de fundação", "Regime de propriedade pretendido",
  "Cargo ocupado na cooperativa",
];
const INTENTIONS = new Map([
  ["collective", "Propriedade coletiva"],
  ["individual", "Propriedade individual"],
  ["both", "Propriedade coletiva e individual"],
]);
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+$/u;

function configurarInquerito() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(TAB_NAME) || spreadsheet.insertSheet(TAB_NAME);
  const header = sheet.getRange(1, 1, 1, HEADERS.length);
  if (sheet.getLastRow() === 0) {
    header.setValues([HEADERS]);
    header.setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else {
    const columns = header.getValues()[0];
    const firstAddedColumn = HEADERS.indexOf("Ano de fundação");
    if (columns.some((value, index) => value !== HEADERS[index] && !(index >= firstAddedColumn && value === ""))) {
      throw new Error("A folha Respostas já existe e tem um cabeçalho diferente.");
    }
    for (let index = firstAddedColumn; index < HEADERS.length; index++) {
      if (columns[index] === "") {
        sheet.getRange(1, index + 1).setValue(HEADERS[index]).setFontWeight("bold");
      }
    }
  }
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_PROPERTY, spreadsheet.getId());
}

function doGet(event) {
  try {
    const sheet = responseSheet_();
    if (event?.parameter?.schema === "founding-year") {
      const column = HEADERS.indexOf("Ano de fundação") + 1;
      return output_({ foundingYear: sheet.getRange(1, column).getValue() === "Ano de fundação" });
    }
    if (event?.parameter?.schema === "intended-property") {
      const column = HEADERS.indexOf("Regime de propriedade pretendido") + 1;
      return output_({ intendedProperty: sheet.getRange(1, column).getValue() === HEADERS[column - 1] });
    }
    if (event?.parameter?.schema === "cooperative-role") {
      return output_({ cooperativeRole: sheet.getRange(1, HEADERS.length).getValue() === HEADERS[HEADERS.length - 1] });
    }
    return output_(totals_(sheet));
  } catch {
    return output_({ error: "Os resultados estão temporariamente indisponíveis." });
  }
}

function doPost(event) {
  const submission = readResponse_(event);
  if (!submission) {
    return output_({ error: "Reveja o nome, o ano de fundação, o cargo, o email e as opções selecionadas." });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    const sheet = responseSheet_();
    const { id, cooperative, email, collective, individual, foundingYear, intendedProperty, cooperativeRole } = submission;
    if (cooperativeRole && sheet.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) {
      return output_({ error: "O serviço está temporariamente indisponível. Tenta novamente." });
    }
    const rowCount = sheet.getLastRow() - 1;
    const rows = rowCount > 0 ? sheet.getRange(2, 1, rowCount, 6).getValues() : [];
    const totals = { responses: 0, collective: 0, individual: 0 };
    let alreadyRecorded = false;
    for (const [storedId, , , , storedCollective, storedIndividual] of rows) {
      alreadyRecorded = alreadyRecorded || storedId === id;
      countResponse_(totals, storedCollective, storedIndividual);
    }
    if (!alreadyRecorded) {
      sheet.appendRow([
        id, new Date(), literal_(cooperative), literal_(email), collective, individual,
        foundingYear ?? "", INTENTIONS.get(intendedProperty) ?? "", literal_(cooperativeRole ?? ""),
      ]);
      SpreadsheetApp.flush();
      countResponse_(totals, collective, individual);
    }
    return output_(totals);
  } catch {
    return output_({ error: "O serviço está temporariamente indisponível. Tenta novamente." });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function readResponse_(event) {
  const body = event?.postData?.contents;
  if (!body || body.length > 4096) return null;
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  if (!data) return null;
  const { id, cooperative, email, collective, individual, foundingYear, intendedProperty, cooperativeRole } = data;
  const name = typeof cooperative === "string" ? cooperative.trim() : "";
  const contact = typeof email === "string" ? email.trim() : "";
  if (typeof id !== "string" || !UUID.test(id) || !name || name.length > 120 ||
      contact.length > 254 || !EMAIL.test(contact) ||
      typeof collective !== "boolean" || typeof individual !== "boolean") {
    return null;
  }
  if (collective || individual ? intendedProperty != null : !INTENTIONS.has(intendedProperty)) return null;
  if (foundingYear != null && (!Number.isInteger(foundingYear) || foundingYear < 1000 || foundingYear > new Date().getFullYear())) {
    return null;
  }
  const role = typeof cooperativeRole === "string" ? cooperativeRole.trim() : "";
  if (cooperativeRole !== undefined && (!role || role.length > 120)) return null;
  return { id: id.toLowerCase(), cooperative: name, email: contact, collective, individual, foundingYear, intendedProperty, cooperativeRole: role };
}

function responseSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_PROPERTY);
  if (!id) throw new Error("Executa configurarInquerito no editor.");
  return SpreadsheetApp.openById(id).getSheetByName(TAB_NAME);
}

function totals_(sheet) {
  const rows = sheet.getLastRow() - 1;
  const result = { responses: 0, collective: 0, individual: 0 };
  if (rows < 1) return result;
  for (const [collective, individual] of sheet.getRange(2, 5, rows, 2).getValues()) {
    countResponse_(result, collective, individual);
  }
  return result;
}

function countResponse_(result, collective, individual) {
  if (collective === true) result.collective++;
  if (individual === true) result.individual++;
  if (collective === true || individual === true) result.responses++;
}

function literal_(value) {
  // Keep values supplied by visitors as text when Google Sheets evaluates a cell.
  return /^[=+@\-]/.test(value) ? "'" + value : value;
}

function output_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
