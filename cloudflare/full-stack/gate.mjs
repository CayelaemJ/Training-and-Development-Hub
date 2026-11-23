// Default-deny deployment gate for the actual CABO Learning Hub workspace.
export function validateLearningHubCutover(env,host) {
 const failures=[];
 if(env.CABO_LEARNING_BACKEND_ENABLED!=="true")failures.push("Backend disabled");
 if(!env.CABO_LEARNING_HOST||host!==env.CABO_LEARNING_HOST)failures.push("Invalid canonical host");
 if(!env.CABO_LEARNING_CONTAINER?.getByName)failures.push("Container unavailable");
 if(!env.CABO_LEARNING_DATABASE_URL)failures.push("Database secret missing");
 if(env.CABO_CHILD_DATA_REVIEW_COMPLETE!=="true")failures.push("Child data governance not approved");
 if(env.CABO_MFA_E2E_VERIFIED!=="true")failures.push("Privileged MFA not verified");
 if(env.CABO_TENANT_ISOLATION_E2E_VERIFIED!=="true")failures.push("Tenant isolation not verified");
 if(env.CABO_OIDC_ORIGIN_VERIFIED!=="true")failures.push("OIDC origin not verified");
 return {ready:failures.length===0,failures};
}
