/**
 * Built-in REST client for the UIID Issuer API.
 *
 * It mirrors the public surface of the official JavaScript SDK
 * (getIssuer, createUiid) so the demo works even before the official
 * SDK has been downloaded into vendor/.
 *
 * Endpoints (from the UIID Issuer SDK guide):
 *   GET  /api/v1/issuer        -> Issuer ID and counters
 *   POST /api/v1/issuer/uiids  -> Create a UIID anchored to your Issuer ID
 */
export class UiidApiError extends Error {
  constructor(status, body) {
    const code = body?.error || body?.code || `http_${status}`;
    super(body?.error_description || body?.message || code);
    this.name = "UiidApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class RestIssuer {
  #apiKey;
  #baseUrl;
  #timeoutMs;

  constructor({ apiKey, baseUrl = "https://uiid.linkspreed.com", timeoutMs = 15000 } = {}) {
    if (!apiKey) throw new Error("RestIssuer: apiKey is required");
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#timeoutMs = timeoutMs;
  }

  async #request(method, path, body) {
    const headers = {
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.#timeoutMs),
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: "invalid_json", error_description: text.slice(0, 300) };
    }
    if (!res.ok) throw new UiidApiError(res.status, data);
    return data;
  }

  /** Returns the Issuer ID and counters of the authenticated issuer account. */
  getIssuer() {
    return this.#request("GET", "/api/v1/issuer");
  }

  /** Creates a UIID Core ID that is permanently anchored to your Issuer ID. */
  createUiid(input) {
    return this.#request("POST", "/api/v1/issuer/uiids", input ?? {});
  }
}
