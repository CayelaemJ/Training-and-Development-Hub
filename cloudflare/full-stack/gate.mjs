function isHttpsIssuer(value) {
  if (typeof value !== "string" || !value.startsWith("https://") || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
}

function isCanonicalHostname(value) {
  return typeof value === "string" &&
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value);
}

// Default-deny deployment gate for the actual CABO Learning Hub workspace.
export function validateLearningHubCutover(env, host) {
  const failures = [];
  if (env.CABO_LEARNING_BACKEND_ENABLED !== "true") failures.push("Backend disabled");
  if (!isCanonicalHostname(env.CABO_LEARNING_HOST) || host !== env.CABO_LEARNING_HOST) {
    failures.push("Invalid canonical host");
  }
  if (!env.CABO_LEARNING_CONTAINER?.getByName) failures.push("Container unavailable");
  if (!env.CABO_LEARNING_DATABASE_URL) failures.push("Database secret missing");
  if (typeof env.CABO_LEARNING_OIDC_CLIENT_ID !== "string" || !env.CABO_LEARNING_OIDC_CLIENT_ID.trim()) {
    failures.push("OIDC client ID missing");
  }
  if (!isHttpsIssuer(env.CABO_LEARNING_OIDC_ISSUER_URL)) failures.push("Invalid OIDC issuer URL");
  if (env.CABO_CHILD_DATA_REVIEW_COMPLETE !== "true") failures.push("Child data governance not approved");
  if (env.CABO_MFA_E2E_VERIFIED !== "true") failures.push("Privileged MFA not verified");
  if (env.CABO_TENANT_ISOLATION_E2E_VERIFIED !== "true") failures.push("Tenant isolation not verified");
  if (env.CABO_OIDC_ORIGIN_VERIFIED !== "true") failures.push("OIDC origin not verified");
  return { ready: failures.length === 0, failures };
}

export function learningHubContainerEnv(bindings) {
  const browserOrigins = [
    bindings.CABO_LEARNING_HOST && `https://${bindings.CABO_LEARNING_HOST}`,
    bindings.CABO_ALLOWED_ORIGINS,
  ].filter(Boolean).join(",");

  return {
    PORT: "3000",
    NODE_ENV: "production",
    TRUST_PROXY_HOPS: "1",
    FRONTEND_DIST_DIR: "artifacts/training-platform/dist/public",
    DATABASE_URL: bindings.CABO_LEARNING_DATABASE_URL,
    ISSUER_URL: bindings.CABO_LEARNING_OIDC_ISSUER_URL,
    REPL_ID: bindings.CABO_LEARNING_OIDC_CLIENT_ID,
    CABO_ALLOWED_ORIGINS: browserOrigins,
    CABO_NATIVE_AUTH_ENABLED: bindings.CABO_OIDC_ORIGIN_VERIFIED === "true" ? "true" : "false",
    CABO_ENVIRONMENT: "cloudflare",
    ENABLE_CABO_DEMO_SEED: "false",
    CABO_GROQ_SMOKE_TEST: "false",
  };
}
