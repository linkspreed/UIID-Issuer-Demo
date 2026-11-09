const $ = (id) => document.getElementById(id);

const els = {
  status: $("status"),
  statusLabel: $("status-label"),
  alert: $("alert"),
  alertTitle: $("alert-title"),
  alertDetail: $("alert-detail"),
  alertHint: $("alert-hint"),
  issuerId: $("issuer-id"),
  stats: $("stats"),
  refresh: $("refresh"),
  issue: $("issue"),
  issued: $("issued"),
  empty: $("empty"),
  raw: $("raw"),
  clientSource: $("client-source"),
  provider: $("provider"),
  dialog: $("confirm"),
  confirmOk: $("confirm-ok"),
  confirmCancel: $("confirm-cancel"),
  confirmClose: $("confirm-close"),
};

/* ---------- Theme (light / dark / system) ---------- */

const media = matchMedia("(prefers-color-scheme: dark)");

function applyTheme(choice) {
  const dark = choice === "dark" || (choice === "system" && media.matches);
  document.documentElement.classList.toggle("dark", dark);
}

function initTheme() {
  let choice = "system";
  try { choice = localStorage.getItem("theme") || "system"; } catch {}
  const input = document.querySelector(`input[name="theme"][value="${choice}"]`);
  if (input) input.checked = true;

  document.querySelectorAll('input[name="theme"]').forEach((el) =>
    el.addEventListener("change", () => {
      try { localStorage.setItem("theme", el.value); } catch {}
      applyTheme(el.value);
    })
  );
  media.addEventListener("change", () => {
    const current = document.querySelector('input[name="theme"]:checked')?.value ?? "system";
    if (current === "system") applyTheme("system");
  });
}

/* ---------- Helpers ---------- */

function setStatus(state, label) {
  els.status.dataset.state = state;
  els.statusLabel.textContent = label;
}

function showError(error) {
  els.alertTitle.textContent = error?.message || "Something went wrong.";
  const detail = error?.detail && error.detail !== error.message ? `UIID says: ${error.detail}` : "";
  els.alertDetail.textContent = detail;
  els.alertDetail.hidden = !detail;
  els.alertHint.textContent = error?.hint || "";
  els.alertHint.hidden = !error?.hint;
  els.alert.hidden = false;
}

function clearError() {
  els.alert.hidden = true;
}

function showRaw(label, data) {
  els.raw.textContent = `${label}\n\n${JSON.stringify(data, null, 2)}`;
}

async function api(path, options = {}, { quiet = false } = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch {
    throw { message: "The demo server is not reachable.", hint: "Is \"npm start\" still running?" };
  }
  const data = await res.json().catch(() => ({}));
  if (!quiet) showRaw(`${options.method || "GET"} ${path} -> ${res.status}`, data);
  if (!res.ok || data.ok === false) throw data.error || { message: `Request failed (${res.status}).` };
  return data;
}

function humanize(key) {
  return key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function formatValue(key, value) {
  if (typeof value === "string" && /(_at|date)$/i.test(key)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
  }
  return String(value);
}

async function withBusy(button, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Working";
  try { return await task(); }
  finally { button.disabled = false; button.textContent = original; }
}

/* ---------- Issuer ---------- */

function renderIssuer(issuer) {
  els.issuerId.textContent = issuer?.issuer_id ?? "—";
  els.stats.replaceChildren();
  for (const [key, value] of Object.entries(issuer ?? {})) {
    if (key === "issuer_id" || value === null || typeof value === "object") continue;
    const box = document.createElement("div");
    box.className = "stat";
    const dt = document.createElement("dt");
    dt.textContent = humanize(key);
    const dd = document.createElement("dd");
    dd.textContent = formatValue(key, value);
    box.append(dt, dd);
    els.stats.append(box);
  }
}

async function loadIssuer({ quiet = false } = {}) {
  if (!quiet) clearError();
  setStatus("checking", "Checking");
  try {
    const { issuer } = await api("/api/issuer", {}, { quiet });
    renderIssuer(issuer);
    setStatus("ok", "Connected");
    els.issue.disabled = false;
  } catch (error) {
    setStatus("error", error?.code === "not_configured" ? "Not configured" : "Error");
    els.issue.disabled = true;
    showError(error);
  }
}

/* ---------- Issue flow ---------- */

function addIssued(coreId, issuedAt) {
  els.issued.querySelectorAll("li.new").forEach((li) => li.classList.remove("new"));

  const li = document.createElement("li");
  li.className = "new";
  const text = document.createElement("div");
  text.className = "issued-text";
  const core = document.createElement("p");
  core.className = "core mono";
  core.textContent = coreId;
  const time = document.createElement("time");
  time.dateTime = issuedAt;
  time.textContent = new Date(issuedAt).toLocaleString();
  text.append(core, time);

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn btn-secondary btn-small";
  copy.textContent = "Copy";
  copy.setAttribute("aria-label", `Copy ${coreId}`);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(coreId);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Copy failed";
    }
    setTimeout(() => (copy.textContent = "Copy"), 1500);
  });

  li.append(text, copy);
  els.issued.prepend(li);
  els.empty.hidden = true;
}

async function issue() {
  clearError();
  await withBusy(els.issue, async () => {
    try {
      const { created, issuedAt } = await api("/api/uiids", { method: "POST", body: "{}" });
      addIssued(created?.uiid_core_id ?? JSON.stringify(created), issuedAt);
      await loadIssuer({ quiet: true }); // refresh counters, keep the issue response visible
    } catch (error) {
      showError(error);
    }
  });
}

/* ---------- Confirmation dialog ---------- */

let lastFocus = null;

function openConfirm() {
  lastFocus = document.activeElement;
  els.dialog.showModal();
  els.confirmCancel.focus();
}

function closeConfirm() {
  if (els.dialog.open) els.dialog.close();
}

els.dialog.addEventListener("close", () => lastFocus?.focus());
els.dialog.addEventListener("click", (e) => { if (e.target === els.dialog) closeConfirm(); }); // backdrop
els.dialog.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return; // keep focus inside the panel
  const items = [...els.dialog.querySelectorAll("button:not([disabled])")];
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
els.confirmCancel.addEventListener("click", closeConfirm);
els.confirmClose.addEventListener("click", closeConfirm);
els.confirmOk.addEventListener("click", () => { closeConfirm(); issue(); });

/* ---------- Wiring ---------- */

els.issue.addEventListener("click", openConfirm);
els.refresh.addEventListener("click", () => withBusy(els.refresh, () => loadIssuer()));

async function init() {
  initTheme();
  els.issue.disabled = true;
  try {
    const status = await api("/api/status");
    els.clientSource.textContent = { "official-sdk": "official SDK", "rest-fallback": "REST fallback", none: "none" }[status.client] ?? status.client;
    els.provider.textContent = status.baseUrl;
    if (!status.configured) {
      setStatus("error", "Not configured");
      showError({ message: "No API key configured.", hint: "Copy .env.example to .env, set UIID_ISSUER_KEY and restart the server." });
      return;
    }
    await loadIssuer();
  } catch (error) {
    setStatus("error", "Offline");
    showError(error);
  }
}

init();
