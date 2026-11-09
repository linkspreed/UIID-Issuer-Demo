import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config, ROOT } from "./lib/config.js";
import { createIssuerClient } from "./lib/issuer-client.js";
import { describeError } from "./lib/errors.js";

const PUBLIC_DIR = path.join(ROOT, "public");
const MAX_BODY_BYTES = 4 * 1024;

const { client, source } = await createIssuerClient(config);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
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
  console.error(`[uiid] ${info.status} ${info.code}${info.detail ? ` (UIID says: ${info.detail})` : ""}`);
  sendJson(res, info.status, { ok: false, error: info });
}

/**
 * Blocks requests from other websites (CSRF). A page on another origin
 * cannot send Content-Type: application/json without a CORS preflight,
 * and we also compare the Origin header with our own host.
 */
function isSameOriginJson(req) {
  const type = req.headers["content-type"] || "";
  if (!type.startsWith("application/json")) return false;
  const origin = req.headers.origin;
  if (!origin) return true; // e.g. curl from the same machine
  return origin === `http://${req.headers.host}`;
}

async function drainBody(req) {
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Body too large"), { status: 413, code: "body_too_large" });
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
      return sendJson(res, 403, {
        ok: false,
        error: { status: 403, code: "forbidden_origin", message: "Request blocked.", hint: "Use the demo page served by this server." },
      });
    }
    await drainBody(req);

    // Documented SDK call: createUiid() takes no arguments.
    // UIID creates the Core ID and anchors it to your Issuer ID in one step.
    const created = await client.createUiid();
    console.log(`[uiid] Issued ${created?.uiid_core_id ?? "(no uiid_core_id in response)"}`);
    sendJson(res, 201, { ok: true, created, issuedAt: new Date().toISOString() });
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
    if (pathname.startsWith("/api/")) {
      return sendJson(res, 404, { ok: false, error: { status: 404, code: "not_found", message: "Unknown endpoint." } });
    }
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
