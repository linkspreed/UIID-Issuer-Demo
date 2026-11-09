import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Minimal .env loader (no dependency). Existing environment variables win,
 * so you can still override values from the shell or a CI system.
 */
function loadDotEnv(file = path.join(ROOT, ".env")) {
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

function parsePort(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

/** Removes things people often paste by accident: quotes, "Bearer ", whitespace. */
function cleanKey(raw) {
  return (raw || "")
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/\s+/g, "");
}

const clientMode = (process.env.UIID_CLIENT || "auto").toLowerCase();

export const config = Object.freeze({
  apiKey: cleanKey(process.env.UIID_ISSUER_KEY),
  baseUrl: (process.env.UIID_BASE_URL || "https://uiid.linkspreed.com").trim().replace(/\/+$/, ""),
  clientMode: ["auto", "sdk", "rest"].includes(clientMode) ? clientMode : "auto",
  host: process.env.HOST || "127.0.0.1",
  port: parsePort(process.env.PORT, 3000),
  sdkPath: path.join(ROOT, "vendor", "uiid-issuer-sdk.js"),
});
