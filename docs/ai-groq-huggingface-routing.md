# CABO multi-provider AI routing (Groq + Hugging Face)

CABO's server-side JSON AI completion pipeline can now distribute work across Groq and Hugging Face Inference Providers. The application still validates each AI response before it can affect a learner record or an assessment. No credential, learner identifier or prompt is sent to the browser's configuration endpoint.

## Intended division of work

| Task | Default first-choice share when both services are healthy | If first attempt fails |
| --- | --- | --- |
| Development-plan drafts | Hugging Face 75%, Groq 25% | Try the other provider |
| Written exam generation | Hugging Face 75%, Groq 25% | Try the other provider |
| Written-answer grading/feedback | Groq 75%, Hugging Face 25% | Try the other provider |
| Generic structured JSON / admin smoke tests | Groq 50%, Hugging Face 50% | Try the other provider |

These are **routing preferences**, not assertions that one model is objectively better at an educational task. They require validation against your own anonymized evaluation set. They are weighted selections **per server process** and can vary with failures, cooldowns and unequal task volume; they are not global quotas or guaranteed request percentages. If a third legacy OpenAI provider is configured, it remains **last-resort fallback**.

The routing layer currently handles structured chat completions used by written exams, marking and development plans. Image generation, embeddings, live streaming tutor chat or offline native inference require separate integrations and are **not** implied by this PR.

## Render environment variables

Set these only as server-side runtime environment variables, never in source control, frontend build variables, browser storage, screenshots, PR descriptions or public logs.

- \`GROQ_API_KEY\`: Groq inference credential.
- \`HF_TOKEN\`: Hugging Face token permitted to call Inference Providers (preferred). \`HUGGINGFACE_API_KEY\` is supported as an alternative.
- \`HF_CHAT_MODEL\`: Inference Providers chat model; default \`openai/gpt-oss-120b:cheapest\`. Verify model access, context and costs before deployment. Model suffixes are a Hugging Face feature.
- \`GROQ_EXAM_MODEL\`: optional Groq chat model override.
- \`CABO_AI_GROQ_WEIGHT\`: optional global multiplier 0–100, default 1.
- \`CABO_AI_HF_WEIGHT\`: optional global multiplier 0–100, default 1.

For a pure two-provider installation, do not set \`OPENAI_API_KEY\`. One missing provider is acceptable; its workloads route to the available one. If **all** inference providers fail, the API produces a retriable error or preserves the existing deterministic fallback for development-plan drafts.

**Security:** Create a *new* fine-grained Hugging Face token with the minimum required Inference Providers permission. A read/write Hub token is unnecessarily privileged for chat inference. Any credential disclosed in a chat should be replaced and revoked through its issuer before production. Review Groq token exposure too; a new token is not automatically active on Render.

## Validation and rollout

1. Run local and CircleCI unit tests: \`node --test artifacts/api-server/src/tests/*.test.mjs\`. Also run \`pnpm run build\` with the pinned workspace tooling.
2. Review the generated pull request diff and verify no secret values appear.
3. Configure **rotated** credentials in Render in a test/staging deployment. Start with synthetic test data only. Do not run load tests against production or children's records.
4. As an authenticated CABO platform superadmin, POST \`/platform/mlops/smoke-test\` with \`{"provider":"groq"}\`, then \`{"provider":"huggingface"}\`. The endpoint uses one synthetic JSON completion per call and returns a provider/model/latency without exposing tokens. Requests lacking platform superadmin access must be rejected.
5. Validate representative exam generation, grading and development plans using non-identifying source material. Review factual grounding, assessment fairness, JSON schemas, timeouts, latency, 429 handling, failure recovery and provider-specific spending.
6. Review \`/platform/mlops\` for provider usage distribution, failures and latency. Existing metrics are capped to a 7-day recent window and are not a provider invoice or complete token-level cost record.
7. Deploy in stages; roll back by reverting the PR or disabling one provider via secret configuration. Do not disable all inference keys unless deterministic draft plans and temporary 503s are acceptable.

**Data protection:** Minimize learner data before calling either provider, document data flows and transfer implications under applicable South African/Botswana privacy obligations, and obtain appropriate safeguards for children's information. Never assume that AI-generated grades are verified official records without human review.

**Quota behavior:** A 429 from one provider triggers a cooldown and immediate alternative-provider attempt without repeated immediate calls to the limited provider. A global increase in throughput is **not** guaranteed, and this routing is not intended to evade any supplier's usage restrictions.

**Architecture limitations:** Cooldowns and routing counters are in memory per Render instance. Multiple horizontally scaled replicas should eventually use shared provider-health state, distributed rate limits, concurrency budgets, cost ceilings and a central circuit breaker. This PR does not assert those protections are distributed.

## Isolated Render pre-demo readiness gate (deployed)

The separately hosted **[CABO Groq/Hugging Face test service](https://dashboard.render.com/web/srv-dbg6r5sipgvc73emrvkg)** runs the exact `completeAIJson` implementation from this PR with one fixed, non-identifying science question per provider. Its repo branch is `feat/groq-hf-balanced-ai-routing`, and its build command is `bash scripts/render-build.sh`.

- This service is a **separate free Render deployment**, not the CABO pilot, and does **not** connect to a learner database.
- `CABO_ENVIRONMENT=testing`, `CABO_AI_LIVE_PROBE=true`, `NODE_ENV=production` are configured.
- Its start command is `node artifacts/api-server/scripts/isolated-ai-live-probe.mjs`.
- Its **public readiness endpoint** `https://cabo-ai-groq-hf-isolated-probe.onrender.com/healthz` returns HTTP 200 with `{"status":"ready"}` **only when both** configured providers returned grounded, validated JSON on startup. Otherwise it returns HTTP 503 and `{"status":"not_ready"}`. It exposes no prompts, keys, or learner data.
- **Initial actual deployment on 27 October 2026: code launched successfully, both provider credentials were UNCONFIGURED in this new isolated service, so readiness was correctly FALSE.** This does not mean the providers are broken or their credentials are configured on any other CABO service.
- A trusted administrator must create new least-privilege provider credentials in the issuers' consoles (revoke any previously chat-disclosed tokens), then add `GROQ_API_KEY` and `HF_TOKEN` using **Render Dashboard → cabo-ai-groq-hf-isolated-probe → Environment**. Saving configuration triggers a deploy/restart; the probe runs again with a single safe synthetic request per provider. Do not put key contents in chat, source control or CI logs.
- Inspect Render application logs for `cabo_ai_live_probe_summary`; successful providers log provider name, model and latency only. Inspect the readiness endpoint only after the deploy is LIVE. A healthy probe verifies connectivity and structured response parsing, **not** educational answer quality, permissions, uploaded-file workflows, cost ceilings or production system security.
- Production pilot and CABO main are unchanged by this isolated test. Do not merge or promote until successful real credentials, user-flow E2E and privacy gates are documented.
