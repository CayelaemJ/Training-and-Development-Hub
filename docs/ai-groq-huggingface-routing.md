# CABO Groq-first AI routing

CABO's server-side structured AI completion pipeline uses **Groq only by default** for development plans, exams, quizzes and grading. Every response is schema-validated before it can affect learner records. Provider credentials remain server-side.

Hugging Face and OpenAI are disabled unless an administrator explicitly enables their feature flags. This keeps the active learner path on Groq while preserving a controlled option to evaluate another provider later. Weighting settings have no effect on Hugging Face traffic while its flag is off.

## Current provider behavior

| Setting | Default | Effect |
| --- | --- | --- |
| Groq | Enabled when `GROQ_API_KEY` is configured | Handles all AI tasks |
| Hugging Face | Disabled | Enable only with `CABO_AI_HF_ENABLED=true`, a server-side token, available credit and an approved evaluation |
| OpenAI fallback | Disabled | Enable only with `CABO_AI_OPENAI_FALLBACK_ENABLED=true` and explicit approval |

If Groq is unavailable or over quota while the other providers remain disabled, the request fails safely with the existing retryable response or deterministic development-plan fallback. No other provider is called.

The integration covers structured chat completions for development plans, written exams, quizzes and marking. It does not implement learner chat memory, document embeddings, RAG retrieval, image generation, live streaming or offline native inference.

## Render environment variables

Set values only as server-side runtime environment variables. Never place credentials in source control, frontend build variables, browser storage, screenshots, PR descriptions or public logs.

- `GROQ_API_KEY`: Groq inference credential.
- `GROQ_EXAM_MODEL`: optional Groq model override, after checking current model support.
- `CABO_AI_GROQ_WEIGHT`: optional Groq routing weight; defaults to 1.
- `CABO_AI_HF_ENABLED`: leave unset or false to keep Hugging Face disabled. Only set true after a rotated least-privilege token is configured and credit/access and evaluation are confirmed.
- `HF_TOKEN` or `HUGGINGFACE_API_KEY`: Hugging Face Inference Providers credential, used only when the HF feature flag is true.
- `HF_CHAT_MODEL`: optional model override when Hugging Face is explicitly enabled; defaults to `openai/gpt-oss-20b:cheapest`.
- `CABO_AI_HF_WEIGHT`: optional HF routing weight, used only when the HF feature flag is true.
- `CABO_AI_OPENAI_FALLBACK_ENABLED`: leave unset or false to keep OpenAI disabled; set true only after explicit approval.
- `OPENAI_API_KEY`: optional legacy fallback credential, used only when the OpenAI fallback flag is true.

Do not configure Hugging Face or OpenAI credentials in the learner-facing pilot while Groq-only mode is active. The credential shared in chat was cleared from the isolated Render service and should be revoked/rotated with Hugging Face.

## Validation and rollout

1. Run the API regression tests, workspace type checks and build in CI.
2. Review the branch diff and confirm no secret values are present.
3. Keep the current pilot on Groq only; use synthetic, non-identifying inputs for any provider smoke test.
4. The superadmin smoke endpoint defaults to the configured Groq provider. HF/OpenAI provider-specific checks must remain unavailable while their feature flags are off.
5. Review representative exam generation, grading and development plans for grounding, schema validity, latency, quota handling and recovery.
6. Monitor provider/model usage and latency; these metrics are not a provider invoice or complete token-level cost record.
7. Keep this change in draft until code checks pass and the Groq-only rollout is reviewed.

## Isolated Hugging Face/Groq live probe

The separate **[CABO AI provider probe](https://dashboard.render.com/web/srv-dbg6r5sipgvc73emrvkg)** is a free Render service with synthetic prompts only and no learner database. It still tests dual-provider readiness and is separate from the learner-facing Groq-only configuration.

Latest isolated run after clearing the Hugging Face credential (13 November 2026):

- Groq direct inference passed.
- Hugging Face is unconfigured, so the dual-provider probe correctly reports not ready.
- In the preceding run, the Hugging Face 20B route returned HTTP 402. This did not distinguish depleted credit from billing or provider-access configuration.
- Groq fallback and the synthetic classroom exam-generation/grading workflow passed before the HF value was cleared.

The Hugging Face credential shared in chat was configured only on this isolated service, was not committed, and was not added to the learner-facing pilot. Its Render value is now cleared. Revoke/rotate it with Hugging Face; do not paste a replacement token into chat. Do not run more HF calls or purchase credit until access is confirmed and any spend is approved.

Keep the PR in draft until the CI checks are green. A synthetic provider probe confirms connectivity and response parsing only; it does not establish educational quality or production readiness.
