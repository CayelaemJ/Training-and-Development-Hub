/**
 * CABO's HTTP telemetry must never expose learner, guardian, school, document,
 * authentication or URL query identifiers to third-party log retention.
 */
const SAFE_ROUTES = new Set([
  "health", "healthz", "readyz", "auth", "login", "logout", "callback",
  "native", "portal", "platform", "organizations", "storage", "materials",
  "quizzes", "admissions", "reports", "assessment", "academics",
  "attendance", "learner", "parent", "guardian", "schools", "support",
  "api", "ai", "mlops", "governance", "education", "timetable",
  "passport", "courses", "progression", "written-exams",
]);

/** Intentionally low-cardinality; never output URL path parameters or query strings. */
export function safeRequestCategory(url: unknown): string {
  if (typeof url !== "string" || url.length > 4096) return "/other";
  const pathname = url.split("?", 1)[0];
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return "/other";
  const group = parts[1] ?? "api";
  return SAFE_ROUTES.has(group) ? "/api/" + group : "/api/other";
}

/** Error messages and stack traces often contain tokens or personal data. */
export function safeErrorType(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown";
  switch (error.name) {
    case "Error":
    case "TypeError":
    case "SyntaxError":
    case "RangeError":
    case "ReferenceError":
    case "AbortError":
      return error.name;
    default:
      return "ApplicationError";
  }
}

/** Request references are bounded to non-PII random/generated IDs only. */
export function safeRequestReference(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value)) return value;
  return null;
}
