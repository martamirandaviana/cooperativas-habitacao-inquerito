const TAB_NAME = "Respostas";
const SPREADSHEET_PROPERTY = "SURVEY_SPREADSHEET_ID";
const HEADERS = [
  "ID", "Data do envio", "Nome da cooperativa", "Email de contacto",
  "Propriedade coletiva", "Propriedade individual",
];
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
  } else if (header.getValues()[0].some((value, index) => value !== HEADERS[index])) {
    throw new Error("A folha Respostas já existe e tem um cabeçalho diferente.");
  }
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_PROPERTY, spreadsheet.getId());
}

function doGet() {
  try {
    return output_(totals_(responseSheet_()));
  } catch {
    return output_({ error: "Os resultados estão temporariamente indisponíveis." });
  }
}

function doPost(event) {
  const submission = readResponse_(event);
  if (!submission) {
    return output_({ error: "Revê o nome, o email e as opções selecionadas." });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    const sheet = responseSheet_();
    const { id, cooperative, email, collective, individual } = submission;
    const rowCount = sheet.getLastRow() - 1;
    const rows = rowCount > 0 ? sheet.getRange(2, 1, rowCount, HEADERS.length).getValues() : [];
    const totals = { responses: 0, collective: 0, individual: 0 };
    let alreadyRecorded = false;
    for (const [storedId, , , , storedCollective, storedIndividual] of rows) {
      alreadyRecorded = alreadyRecorded || storedId === id;
      countResponse_(totals, storedCollective, storedIndividual);
    }
    if (!alreadyRecorded) {
      sheet.appendRow([id, new Date(), literal_(cooperative), literal_(email), collective, individual]);
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
  const { id, cooperative, email, collective, individual } = data;
  const name = typeof cooperative === "string" ? cooperative.trim() : "";
  const contact = typeof email === "string" ? email.trim() : "";
  if (typeof id !== "string" || !UUID.test(id) || !name || name.length > 120 ||
      contact.length > 254 || !EMAIL.test(contact) ||
      typeof collective !== "boolean" || typeof individual !== "boolean" || !(collective || individual)) {
    return null;
  }
  return { id: id.toLowerCase(), cooperative: name, email: contact, collective, individual };
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
