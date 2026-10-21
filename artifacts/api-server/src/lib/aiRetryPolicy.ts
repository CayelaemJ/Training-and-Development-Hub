/** Keep provider-wide failures from being amplified across every configured model. */
export function aiFailureAction(
  error: { status?: number; name?: string },
  jsonMode: boolean,
): "next-provider" | "next-model" | "retry-without-json" {
  const status = error.status;
  if (status === 401 || status === 403 || status === 429 ||
      (status !== undefined && status >= 500) ||
      error.name === "APIConnectionError" || error.name === "APIConnectionTimeoutError") {
    return "next-provider";
  }
  // An unavailable model should not prevent another model from being tried.
  if (status === 404) return "next-model";
  // Retry output validation errors and providers that reject response_format.
  if (jsonMode && (status === undefined || status === 400 || status === 422)) {
    return "retry-without-json";
  }
  return "next-model";
}
