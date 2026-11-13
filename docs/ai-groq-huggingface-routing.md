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
- \`HF_CHAT_MODEL\`: Inference Providers chat model; default \`openai/gpt-oss-20b:cheapest\`. The 20B model is the lower-size default to limit usage. `:cheapest` chooses the lowest-priced available inference provider; it does not make inference free. Verify model access, context and costs before deployment.
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

## Isolated Hugging Face/Groq live probe

The separate **[CABO AI provider probe](https://dashboard.render.com/web/srv-dbg6r5sipgvc73emrvkg)** is a free Render service with synthetic prompts only and no learner database. It starts `artifacts/api-server/scripts/isolated-ai-live-probe.mjs`; the public `/healthz` endpoint reports ready only after both direct provider calls return validated JSON.

Latest isolated run (13 November 2026), with Hugging Face model `openai/gpt-oss-20b:cheapest`:

- Groq direct inference passed.
- Hugging Face direct inference returned HTTP 402. The probe therefore reports not ready; this response does not distinguish exhausted free credit from account billing or provider access configuration.
- Groq fallback passed, and the synthetic classroom exam-generation/grading workflow passed using Groq.
- The earlier Hugging Face `openai/gpt-oss-120b:nscale` route returned HTTP 410 (`model_no_longer_supported`). The current 20B `:cheapest` default is smaller, but `:cheapest` does not mean free.

The Hugging Face credential shared in chat was configured only on this isolated service; its Render value has now been cleared, and Render is applying the environment update. It was not committed and was not added to the learner-facing pilot. Treat it as exposed and revoke/rotate it in Hugging Face; use a new least-privilege token with Inference Providers permission. Check available inference credit/provider access before further live calls. Do not run additional HF calls or purchase credits until the account has available credit and the owner approves any spend.

Keep the PR in draft and do not merge or promote it to the public pilot until a direct Hugging Face call succeeds with an authorized token, followed by review of combined provider behavior, learner-flow E2E and privacy gates. A successful synthetic probe would confirm connectivity and response parsing only, not educational quality or production readiness.
