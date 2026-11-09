/**
 * Setup check: verifies your configuration and calls GET /api/v1/issuer.
 * Does NOT issue anything.
 */
import { existsSync } from "node:fs";
import { config } from "../lib/config.js";
import { createIssuerClient } from "../lib/issuer-client.js";
import { describeError } from "../lib/errors.js";

const ok = (msg) => console.log(`  [ok]   ${msg}`);
const fail = (msg) => console.log(`  [fail] ${msg}`);
const info = (msg) => console.log(`  [info] ${msg}`);

console.log("\nUIID Issuer Demo — setup check\n");

const [major] = process.versions.node.split(".").map(Number);
major >= 18 ? ok(`Node.js ${process.versions.node}`) : fail(`Node.js ${process.versions.node} (18 or newer required)`);

existsSync(".env") ? ok(".env file found") : info(".env file not found (using environment variables only)");

if (!config.apiKey) {
  fail("UIID_ISSUER_KEY is not set");
  console.log("\n  Copy .env.example to .env and add your API key.\n");
  process.exit(1);
}
const k = config.apiKey;
ok(`API key set (${k.length} characters, starts with "${k.slice(0, 4)}", ends with "${k.slice(-2)}")`);
if (process.env.UIID_ISSUER_KEY && process.env.UIID_ISSUER_KEY.trim() !== k) {
  info("Removed quotes, spaces or a \"Bearer \" prefix from the key.");
}
ok(`Provider: ${config.baseUrl}`);

existsSync(config.sdkPath)
  ? ok("Official SDK found in vendor/")
  : info("Official SDK not downloaded — run: npm run sdk:fetch (REST fallback works meanwhile)");

try {
  const { client, source } = await createIssuerClient(config);
  info(`Client in use: ${source}`);
  const issuer = await client.getIssuer();
  ok(`Connected. Issuer ID: ${issuer?.issuer_id ?? "(not in response)"}`);
  console.log("\n  Full response:");
  console.log(JSON.stringify(issuer, null, 2).replace(/^/gm, "    "));
  console.log("\n  All good. Start the demo with: npm start\n");
} catch (err) {
  const e = describeError(err);
  fail(`${e.status} ${e.code}: ${e.message}`);
  if (e.detail) console.log(`         UIID says: ${e.detail}`);
  if (e.hint) console.log(`         ${e.hint}`);
  console.log();
  process.exit(1);
}
