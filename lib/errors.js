/**
 * Turns any error (official SDK, REST fallback, network) into a small,
 * predictable object that the UI and the CLI can show to humans.
 */
const KNOWN = {
  unauthorized: {
    status: 401,
    message: "The API key is missing or invalid.",
    hint: "Check UIID_ISSUER_KEY in your .env file and restart the server.",
  },
  issuer_not_activated: {
    status: 403,
    message: "This account has not activated the Issuer program.",
    hint: "Open the Issuer panel in the UIID dashboard sidebar and activate it. Only Company, Collective and Government accounts can do this.",
  },
  invalid_identifiers: {
    status: 400,
    message: "The Core ID is missing or longer than 64 characters.",
    hint: "Leave the Core ID field empty, or press Generate to get a valid one.",
  },
};

export function describeError(err) {
  const status = Number(err?.status ?? err?.statusCode ?? err?.response?.status) || undefined;
  let code = err?.code ?? err?.error ?? err?.body?.error;

  if (!code && status === 401) code = "unauthorized";
  if (!code && status === 403) code = "issuer_not_activated";

  if (code && KNOWN[code]) {
    return { status: status ?? KNOWN[code].status, code, message: KNOWN[code].message, hint: KNOWN[code].hint };
  }

  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return { status: 504, code: "timeout", message: "The UIID server did not answer in time.", hint: "Try again in a moment." };
  }

  if (err?.cause?.code === "ENOTFOUND" || err?.cause?.code === "ECONNREFUSED" || err?.message === "fetch failed") {
    return {
      status: 502,
      code: "network_error",
      message: "The UIID server could not be reached.",
      hint: "Check UIID_BASE_URL, your internet connection and any company proxy.",
    };
  }

  if (status === 429) {
    return { status, code: "rate_limited", message: "Too many requests.", hint: "The API allows 100 requests per minute. Wait a moment." };
  }

  return {
    status: status ?? 500,
    code: typeof code === "string" ? code : "unexpected_error",
    message: err?.message || "Something went wrong.",
    hint: "See the server console for details.",
  };
}
