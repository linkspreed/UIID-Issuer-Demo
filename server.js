import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config, ROOT } from "./lib/config.js";
import { createIssuerClient } from "./lib/issuer-client.js";
import { describeError } from "./lib/errors.js";

const PUBLIC_DIR = path.join(ROOT, "public");
const MAX_BODY_BYTES = 4 * 1024;
const CORE_ID_PATTERN = /^[\x21-\x7E]{1,64}$/; // printable ASCII, no spaces, max 64

const { client, source } = await createIssuerClient(config);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, err) {
  const info = describeError(err);
  console.error(`[uiid] ${info.status} ${info.code}: ${err?.message ?? err}`);
  sendJson(res, info.status, { ok: false, error: info });
}

/**
 * Blocks requests from other websites (CSRF). A page on another origin
 * cannot set Content-Type: application/json without a CORS preflight,
 * and we also compare the Origin header with our own host.
 */
function isSameOriginJson(req) {
  const type = req.headers["content-type"] || "";
  if (!type.startsWith("application/json")) return false;
  const origin = req.headers.origin;
  if (!origin) return true; // e.g. curl from the same machine
  return origin === `http://${req.headers.host}`;
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Body too large"), { status: 413, code: "body_too_large" });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400, code: "invalid_json" });
  }
}

function requireClient(res) {
  if (client) return true;
  sendJson(res, 503, {
    ok: false,
    error: {
      status: 503,
      code: "not_configured",
      message: "No API key configured.",
      hint: "Copy .env.example to .env, set UIID_ISSUER_KEY and restart the server.",
    },
  });
  return false;
}

const routes = {
  "GET /api/status": async (_req, res) => {
    sendJson(res, 200, { ok: true, configured: Boolean(client), client: source, baseUrl: config.baseUrl });
  },

  "GET /api/issuer": async (_req, res) => {
    if (!requireClient(res)) return;
    const issuer = await client.getIssuer();
    sendJson(res, 200, { ok: true, issuer });
  },

  "POST /api/uiids": async (req, res) => {
    if (!requireClient(res)) return;
    if (!isSameOriginJson(req)) {
      return sendJson(res, 403, { ok: false, error: { status: 403, code: "forbidden_origin", message: "Request blocked.", hint: "Use the demo page served by this server." } });
    }
    const body = await readJsonBody(req);
    const coreId = typeof body.coreId === "string" ? body.coreId.trim() : "";

    if (coreId && !CORE_ID_PATTERN.test(coreId)) {
      return sendJson(res, 400, {
        ok: false,
        error: { status: 400, code: "invalid_identifiers", message: "The Core ID must be 1 to 64 characters without spaces.", hint: "Leave the field empty, or press Generate." },
      });
    }

    // Documented SDK call: issuer.createUiid(). An optional Core ID is passed
    // as uiid_core_id (same name as in the documented response).
    const created = coreId ? await client.createUiid({ uiid_core_id: coreId }) : await client.createUiid();
    console.log(`[uiid] Issued ${created?.uiid_core_id ?? "(see response)"}`);
    sendJson(res, 201, { ok: true, created, issuedAt: new Date().toISOString() });
  },

  "GET /api/core-id/generate": async (_req, res) => {
    // Public utility endpoint, no API key needed. Proxied to avoid CORS.
    const upstream = await fetch(`${config.baseUrl}/api/v1/core/uiid/generate`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || typeof data.uiid !== "string") {
      throw Object.assign(new Error("Could not generate a Core ID"), { status: 502, code: "generate_failed" });
    }
    sendJson(res, 200, { ok: true, uiid: data.uiid });
  },
};

async function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, file));
  if (!resolved.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(resolved);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": MIME[path.extname(resolved)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const handler = routes[`${req.method} ${pathname}`];
  try {
    if (handler) return await handler(req, res);
    if (pathname.startsWith("/api/")) return sendJson(res, 404, { ok: false, error: { status: 404, code: "not_found", message: "Unknown endpoint." } });
    if (req.method === "GET" || req.method === "HEAD") return await serveStatic(req, res, pathname);
    res.writeHead(405).end();
  } catch (err) {
    sendError(res, err);
  }
});

server.listen(config.port, config.host, () => {
  const label = { "official-sdk": "official UIID Issuer SDK", "rest-fallback": "built-in REST client", none: "not configured" }[source];
  console.log(`\n  UIID Issuer Demo`);
  console.log(`  -> http://${config.host}:${config.port}`);
  console.log(`  Provider: ${config.baseUrl}`);
  console.log(`  Client:   ${label}\n`);
  if (!client) console.log("  Set UIID_ISSUER_KEY in .env to start issuing.\n");
});
