import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RestIssuer } from "./rest-issuer.js";

/**
 * Creates the issuer client used by the demo.
 *
 * Preferred: the official UIID Issuer SDK (vendor/uiid-issuer-sdk.js),
 * downloaded with "npm run sdk:fetch". It is not committed to this
 * repository, so you always run the version published by the provider.
 *
 * Fallback: the built-in REST client with the same method names.
 */
export async function createIssuerClient(config) {
  if (!config.apiKey) {
    return { client: null, source: "none", reason: "UIID_ISSUER_KEY is not set" };
  }

  const wantSdk = config.clientMode !== "rest";
  const sdkAvailable = existsSync(config.sdkPath);

  if (wantSdk && sdkAvailable) {
    try {
      const mod = await import(pathToFileURL(config.sdkPath).href);
      const UiidIssuer = mod.UiidIssuer ?? mod.default?.UiidIssuer ?? mod.default;
      if (typeof UiidIssuer !== "function") {
        throw new Error("vendor/uiid-issuer-sdk.js does not export UiidIssuer");
      }
      // apiKey is the documented option. baseUrl is passed as a hint for
      // self-hosted instances; the SDK may ignore it.
      const client = new UiidIssuer({ apiKey: config.apiKey, baseUrl: config.baseUrl });
      return { client, source: "official-sdk" };
    } catch (err) {
      if (config.clientMode === "sdk") throw err;
      console.warn(`[uiid] Could not load the official SDK, using REST fallback: ${err.message}`);
    }
  } else if (config.clientMode === "sdk") {
    throw new Error("UIID_CLIENT=sdk but vendor/uiid-issuer-sdk.js is missing. Run: npm run sdk:fetch");
  }

  return {
    client: new RestIssuer({ apiKey: config.apiKey, baseUrl: config.baseUrl }),
    source: "rest-fallback",
  };
}
