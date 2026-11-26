const adminPath = "/administracao";
const pageSize = 25;
const headers = {
  "Cache-Control": "private, no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const dateFormat = new Intl.DateTimeFormat("pt-PT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Lisbon",
});

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => entities[character]);

function page(title, content, status = 200) {
  return new Response(`<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Cooperativas de Habitação</title>
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/manrope.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/admin.css">
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <a class="admin-back" href="/">Voltar ao inquérito</a>
    </div>
  </header>
  <main class="admin-shell">
    <h1>${title}</h1>
    ${content}
  </main>
</body>
</html>`, { status, headers });
}

function answerDetails(row) {
  const categories = [];
  if (row.collective) categories.push("Propriedade coletiva");
  if (row.individual) categories.push("Propriedade individual");
  const date = new Date(row.created_at.replace(" ", "T") + "Z");

  return `<div class="answer-info">
    <h2>${escapeHTML(row.cooperative)}</h2>
    <p>${escapeHTML(row.email)}</p>
    <p class="answer-options">${categories.join(" · ")}</p>
  </div>
  <time datetime="${date.toISOString()}">${dateFormat.format(date)}</time>`;
}

async function showResponses(db, url) {
  const pageNumber = Number(url.searchParams.get("pagina") ?? 1);
  const offset = (pageNumber - 1) * pageSize;
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || !Number.isSafeInteger(offset)) {
    return page("Página indisponível", '<a href="/administracao">Voltar às respostas</a>', 400);
  }

  const { results } = await db.prepare(`
    SELECT id, cooperative, email, collective, individual, created_at
    FROM responses ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
  `).bind(pageSize + 1, offset).all();

  const items = results.slice(0, pageSize).map((row) => `
    <li class="admin-answer">
      ${answerDetails(row)}
      <a class="admin-delete-link" href="${adminPath}?apagar=${encodeURIComponent(row.id)}">Apagar<span class="visually-hidden"> resposta de ${escapeHTML(row.cooperative)}</span></a>
    </li>`).join("");

  const pagination = [
    pageNumber > 1 ? `<a href="${adminPath}?pagina=${pageNumber - 1}">Página anterior</a>` : "",
    results.length > pageSize ? `<a href="${adminPath}?pagina=${pageNumber + 1}">Página seguinte</a>` : "",
  ].filter(Boolean).join("");

  const message = url.searchParams.get("apagada") === "1"
    ? '<p class="admin-confirmation" role="status">Resposta apagada. Os totais foram atualizados.</p>'
    : "";

  return page("Respostas do inquérito", `${message}
    ${items ? `<ul class="admin-answers">${items}</ul>` : '<p class="admin-empty">Ainda não há respostas nesta página.</p>'}
    ${pagination ? `<nav class="admin-actions" aria-label="Páginas de respostas">${pagination}</nav>` : ""}`);
}

async function confirmDeletion(db, id) {
  const row = await db.prepare(`
    SELECT id, cooperative, email, collective, individual, created_at
    FROM responses WHERE id = ?
  `).bind(id).first();

  if (!row) {
    return page("Resposta indisponível", '<p>A resposta já não está disponível.</p><a href="/administracao">Voltar às respostas</a>', 404);
  }

  return page("Apagar esta resposta?", `<div class="admin-answer">
      ${answerDetails(row)}
    </div>
    <p>A resposta será eliminada e retirada dos totais. Esta ação é definitiva.</p>
    <form class="admin-actions" method="post" action="${adminPath}">
      <input type="hidden" name="id" value="${escapeHTML(row.id)}">
      <button class="button admin-danger" type="submit">Apagar definitivamente</button>
      <a href="${adminPath}">Cancelar</a>
    </form>`);
}

export async function administration(request, env, url) {
  if (!env.ADMIN_EMAIL) {
    return page("Área de administração indisponível", '<a href="/">Voltar ao inquérito</a>', 503);
  }

  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!userId || email !== env.ADMIN_EMAIL.trim().toLowerCase()) {
    if (request.method !== "GET" || userId) {
      return page("Acesso reservado", '<a href="/">Voltar ao inquérito</a>', 403);
    }

    return page("Área de administração", `
      <p>Inicia sessão com a conta que gere este inquérito.</p>
      <a class="button" href="/signin-with-chatgpt?return_to=%2Fadministracao" target="_top">Iniciar sessão com ChatGPT</a>`, 401);
  }

  if (request.method === "GET") {
    const id = url.searchParams.get("apagar");
    return id ? confirmDeletion(env.DB, id) : showResponses(env.DB, url);
  }

  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, POST" } });
  }

  if (request.headers.get("Origin") !== url.origin) {
    return page("Pedido recusado", '<a href="/administracao">Voltar às respostas</a>', 403);
  }

  const id = (await request.formData()).get("id");
  if (typeof id !== "string" || id.length !== 36) {
    return page("Resposta inválida", '<a href="/administracao">Voltar às respostas</a>', 400);
  }

  const result = await env.DB.prepare("DELETE FROM responses WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) {
    return page("Resposta indisponível", '<p>A resposta já não está disponível.</p><a href="/administracao">Voltar às respostas</a>', 404);
  }

  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: adminPath + "?apagada=1" },
  });
}
