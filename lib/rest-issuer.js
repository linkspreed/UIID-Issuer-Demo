/**
 * Built-in REST client for the UIID Issuer API.
 *
 * It mirrors the official JavaScript SDK v1 (same requests, same method
 * names, same error shape), so the demo also works before the official
 * SDK has been downloaded into vendor/.
 *
 *   GET  /api/v1/issuer        -> Issuer ID, creation date and counters
 *   POST /api/v1/issuer/uiids  -> Create a UIID anchored to your Issuer ID
 */
export class UiidIssuerError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "UiidIssuerError";
    this.status = status;
    this.body = body;
  }
}

export class RestIssuer {
  #apiKey;
  #baseUrl;
  #timeoutMs;

  constructor({ apiKey, baseUrl = "https://uiid.linkspreed.com", timeoutMs = 15000 } = {}) {
    if (!apiKey) throw new Error("apiKey is required");
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#timeoutMs = timeoutMs;
  }

  async #request(method, path) {
    const res = await fetch(this.#baseUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    if (!res.ok) {
      throw new UiidIssuerError((data && data.error) || `Request failed with status ${res.status}`, res.status, data);
    }
    return data;
  }

  /** Returns the Issuer ID, creation date and issuance counters. */
  getIssuer() {
    return this.#request("GET", "/api/v1/issuer");
  }

  /** Creates a UIID permanently anchored to this Issuer ID. */
  createUiid() {
    return this.#request("POST", "/api/v1/issuer/uiids");
  }
}
