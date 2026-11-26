import { administration } from "./admin.js";

const aggregates = `
  SELECT COUNT(*) AS responses,
         COUNT(*) FILTER (WHERE collective = 1) AS collective,
         COUNT(*) FILTER (WHERE individual = 1) AS individual
  FROM responses
`;

const insertResponse = `
  INSERT INTO responses (id, cooperative, email, collective, individual)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`;

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const emailAddress = /^[^\s@]+@[^\s@]+$/u;

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

async function readSubmission(request) {
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let input = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      return null;
    }
    input += decoder.decode(value, { stream: true });
  }

  try {
    return JSON.parse(input + decoder.decode());
  } catch {
    return null;
  }
}

async function submit(request, db) {
  const contentType = request.headers.get("Content-Type")?.split(";")[0].trim();
  if (contentType !== "application/json") {
    return json({ error: "Formato de resposta inválido." }, 415);
  }

  const { id, cooperative, email, collective, individual } = (await readSubmission(request)) ?? {};
  const name = typeof cooperative === "string" ? cooperative.trim() : "";
  const contact = typeof email === "string" ? email.trim() : "";
  const validOptions = typeof collective === "boolean" &&
    typeof individual === "boolean" && (collective || individual);

  if (typeof id !== "string" || !uuid.test(id) || !name || name.length > 120 ||
      contact.length > 254 || !emailAddress.test(contact) || !validOptions) {
    return json({ error: "Revê o nome, o email e as opções selecionadas." }, 400);
  }

  // D1 runs the batch in one transaction. A retry with the same ID counts once.
  const [, totals] = await db.batch([
    db.prepare(insertResponse).bind(id.toLowerCase(), name, contact, Number(collective), Number(individual)),
    db.prepare(aggregates),
  ]);
  return json(totals.results[0], 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      if (pathname === "/administracao" || pathname === "/administracao/") {
        return await administration(request, env, url);
      }

      if (pathname === "/api/results") {
        if (request.method !== "GET") {
          return json({ error: "Método inválido." }, 405, { Allow: "GET" });
        }
        return json(await env.DB.prepare(aggregates).first());
      }

      if (pathname === "/api/responses") {
        if (request.method !== "POST") {
          return json({ error: "Método inválido." }, 405, { Allow: "POST" });
        }
        return await submit(request, env.DB);
      }

      return new Response("Página indisponível.", { status: 404 });
    } catch {
      return json({ error: "O serviço está temporariamente indisponível. Tenta novamente." }, 503);
    }
  },
};
