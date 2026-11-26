import { surveyEndpoint } from "./survey-config.js";

const researchDisclosure = document.querySelector(".masthead-inner");
const researchToggle = researchDisclosure.querySelector("summary");
const mouseHover = matchMedia("(any-hover: hover) and (any-pointer: fine)");

// Balance the expansion outside the centred home layout so the hover target stays in place.
new ResizeObserver(() => {
  const expansion = researchDisclosure.getBoundingClientRect().bottom -
    researchToggle.getBoundingClientRect().bottom;
  document.body.style.setProperty("--research-expansion", `${expansion}px`);
}).observe(researchDisclosure);

researchToggle.addEventListener("pointerenter", (event) => {
  if (mouseHover.matches && event.pointerType === "mouse") researchDisclosure.open = true;
});

researchDisclosure.addEventListener("pointerleave", (event) => {
  if (mouseHover.matches && event.pointerType === "mouse") researchDisclosure.open = false;
});

researchToggle.addEventListener("click", (event) => {
  if (mouseHover.matches && event.pointerType === "mouse") event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") researchDisclosure.open = false;
});

const respond = document.querySelector("#respond");
const intro = document.querySelector("#intro");
const formPanel = document.querySelector("#response-panel");
const form = document.querySelector("#response-form");
const fields = document.querySelector("#response-fields");
const submitButton = document.querySelector("#submit-response");
const formError = document.querySelector("#form-error");
const results = document.querySelector("#results-panel");
const resultsError = document.querySelector("#results-error");
const summary = document.querySelector("#results-summary");
const groups = ["collective", "individual"].map((name) => ({
  name,
  count: document.querySelector(`#${name}-count`),
  bar: document.querySelector(`#${name}-bar`),
}));

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const number = new Intl.NumberFormat("pt-PT");
const refreshInterval = 3000;
let responseId;
let refreshing = false;

async function reveal(current, next, focus) {
  if (!reducedMotion.matches && current.animate) {
    await current.animate(
      [{ opacity: 1 }, { opacity: 0, transform: "translateY(-.25rem)" }],
      { duration: 160, easing: "ease-in", fill: "forwards" },
    ).finished;
  }

  current.hidden = true;
  next.hidden = false;

  if (!reducedMotion.matches && next.animate) {
    next.animate(
      [{ opacity: 0, transform: "translateY(.45rem)" }, { opacity: 1 }],
      { duration: 300, easing: "ease-out" },
    );
  }

  focus.focus({ preventScroll: true });
  const { top, bottom } = focus.getBoundingClientRect();
  if (top < 0 || bottom > window.innerHeight) {
    focus.scrollIntoView({ block: "center", behavior: reducedMotion.matches ? "instant" : "smooth" });
  }
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

function showTotals(totals) {
  const maxCount = Math.max(5, ...groups.map(({ name }) => totals[name]));
  const magnitude = 10 ** Math.floor(Math.log10(maxCount));
  const chartMax = [1, 2, 5, 10].map((value) => value * magnitude)
    .find((value) => value >= maxCount);

  for (const { name, count, bar } of groups) {
    const total = totals[name];
    count.textContent = number.format(total);
    count.style.opacity = total === 0 ? "0" : "";
    bar.style.height = `${(100 * total) / chartMax}%`;
  }

  const end = totals.responses === 1 ? "resposta registada" : "respostas registadas";
  const text = `${number.format(totals.responses)} ${end}`;
  if (summary.textContent !== text) summary.textContent = text;
  resultsError.hidden = true;
}

async function fetchTotals() {
  if (document.hidden || refreshing) return;
  refreshing = true;
  try {
    showTotals(await requestSurvey());
  } catch {
    resultsError.hidden = false;
  } finally {
    refreshing = false;
  }
}

async function requestSurvey(submission) {
  if (!surveyEndpoint) throw new Error("Inquérito por configurar.");

  const url = new URL(surveyEndpoint);
  if (!submission) url.searchParams.set("refresh", Date.now());

  // A plain-text POST allows browsers to call the Apps Script web app without a preflight.
  const response = await fetch(url, {
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    ...(submission && {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(submission),
    }),
  });
  if (!response.ok) throw new Error("Serviço indisponível.");
  const payload = await response.json();
  if (typeof payload?.error === "string") {
    if (submission) return payload;
    throw new Error(payload.error);
  }
  if (!["responses", "collective", "individual"].every((key) =>
    Number.isSafeInteger(payload?.[key]) && payload[key] >= 0
  )) throw new Error("Contagem inválida.");
  return payload;
}

respond.addEventListener("click", () => {
  respond.disabled = true;
  if (surveyEndpoint) {
    for (const origin of [new URL(surveyEndpoint).origin, "https://script.googleusercontent.com"]) {
      const connection = document.createElement("link");
      connection.rel = "preconnect";
      connection.href = origin;
      connection.crossOrigin = "anonymous";
      document.head.append(connection);
    }
  }
  reveal(intro, formPanel, form.elements.cooperative);
});

form.addEventListener("input", () => {
  responseId = undefined;
  showFormError("");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (fields.disabled) return;

  const data = new FormData(form);
  const property = data.get("property");
  const collective = property === "collective" || property === "both";
  const individual = property === "individual" || property === "both";
  if (!collective && !individual) {
    showFormError("Seleciona uma opção.");
    form.elements.property[0].focus();
    return;
  }

  const cooperative = data.get("cooperative").trim();
  if (!cooperative) {
    showFormError("Indica o nome da cooperativa.");
    form.elements.cooperative.focus();
    return;
  }

  showFormError("");
  fields.disabled = true;
  submitButton.textContent = "A enviar…";

  try {
    responseId ??= crypto.randomUUID();
    const payload = await requestSurvey({
      id: responseId,
      cooperative,
      email: data.get("email").trim(),
      collective,
      individual,
    });
    if (payload.error) {
      showFormError(payload.error);
      return;
    }

    await reveal(formPanel, results, document.querySelector("#results-heading"));
    showTotals(payload);
    form.reset();
    window.setInterval(fetchTotals, refreshInterval);
    document.addEventListener("visibilitychange", fetchTotals);
    window.addEventListener("focus", fetchTotals);
  } catch {
    showFormError("O envio não pôde ser confirmado. Tenta novamente.");
  } finally {
    if (results.hidden) {
      fields.disabled = false;
      submitButton.textContent = "Enviar resposta";
    }
  }
});

intro.classList.add("is-ready");
respond.hidden = false;
respond.disabled = false;
