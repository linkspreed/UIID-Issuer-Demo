/**
 * Turns any error (official SDK, REST fallback, network) into a small,
 * predictable object that the UI and the CLI can show to humans.
 *
 * The official SDK throws UiidIssuerError with:
 *   message = body.error (e.g. "Invalid or expired token")
 *   status  = HTTP status
 *   body    = parsed JSON body
 * So we decide mainly by HTTP status, and keep the server text as "detail".
 */
const BY_CODE = {
  issuer_not_activated: {
    status: 403,
    message: "This account has not activated the Issuer program.",
    hint: "Open the Issuer panel in the UIID dashboard sidebar and activate it. Only Company, Collective and Government accounts can do this.",
  },
  invalid_identifiers: {
    status: 400,
    message: "UIID rejected the identifiers of this request.",
    hint: "Try again. If it keeps failing, check the server console and contact the UIID provider.",
  },
};

const BY_STATUS = {
  401: {
    code: "unauthorized",
    message: "UIID rejected the API key.",
    hint: "Use the Issuer API key from the same UIID instance as UIID_BASE_URL, paste it without quotes or \"Bearer \", then restart. Run \"npm run check\" to test it.",
  },
  403: {
    code: "forbidden",
    message: "The API key is valid, but not allowed to do this.",
    hint: "Make sure the Issuer program is activated for this account in the UIID dashboard.",
  },
  404: {
    code: "not_found",
    message: "UIID does not know this endpoint.",
    hint: "Check UIID_BASE_URL. It must point to a UIID instance with the Issuer program.",
  },
  429: {
    code: "rate_limited",
    message: "Too many requests.",
    hint: "The API allows 100 requests per minute. Wait a moment.",
  },
};

export function describeError(err) {
  const status = Number(err?.status ?? err?.statusCode) || undefined;
  const body = err?.body && typeof err.body === "object" ? err.body : {};
  const serverText = body.error_description || body.error || err?.message || "";
  const detail = serverText || undefined;

  const code = typeof body.error === "string" ? body.error : err?.code;
  if (code && BY_CODE[code]) {
    return { status: status ?? BY_CODE[code].status, code, ...pick(BY_CODE[code]), detail };
  }
  if (status && BY_STATUS[status]) {
    return { status, ...BY_STATUS[status], detail };
  }

  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return { status: 504, code: "timeout", message: "The UIID server did not answer in time.", hint: "Try again in a moment." };
  }
  if (err?.message === "fetch failed" || ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(err?.cause?.code)) {
    return {
      status: 502,
      code: "network_error",
      message: "The UIID server could not be reached.",
      hint: "Check UIID_BASE_URL, your internet connection and any company proxy.",
      detail: err?.cause?.message,
    };
  }

  return {
    status: status && status >= 400 ? status : 500,
    code: err?.code && typeof err.code === "string" ? err.code : "unexpected_error",
    message: serverText || "Something went wrong.",
    hint: "See the server console for details.",
  };
}

function pick({ message, hint }) {
  return { message, hint };
}
