/**
 * Downloads the official UIID Issuer SDK into vendor/uiid-issuer-sdk.js.
 * The SDK is not committed to this repository; run this once after cloning.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { config } from "../lib/config.js";

const url = `${config.baseUrl}/js/uiid-issuer-sdk.js`;

try {
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const code = await res.text();

  if (!/UiidIssuer/.test(code)) {
    throw new Error("The downloaded file does not look like the UIID Issuer SDK (no 'UiidIssuer' found).");
  }

  await mkdir(path.dirname(config.sdkPath), { recursive: true });
  await writeFile(config.sdkPath, code, "utf8");

  const sha256 = createHash("sha256").update(code).digest("hex");
  console.log(`Saved to vendor/uiid-issuer-sdk.js (${code.length} bytes)`);
  console.log(`SHA-256: ${sha256}`);
  console.log("Next: npm run check");
} catch (err) {
  console.error(`\nCould not download the SDK: ${err.message}`);
  console.error("The demo still works with the built-in REST client.");
  console.error("Behind a company proxy? See 'Troubleshooting' in the README.");
  process.exitCode = 1;
}
