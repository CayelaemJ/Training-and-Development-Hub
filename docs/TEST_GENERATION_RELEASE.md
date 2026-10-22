# Test generation and deletion release

The reported 692 KB policy PDF was saved and extracted successfully (54,648 characters). Generation failed when concurrent large prompts exhausted the configured provider's token allowance.

This change samples document sections into smaller prompts, generates five questions per batch sequentially, and respects upstream Retry-After with a shared per-process cooldown and bounded retries. Completed questions are validated before the whole test is saved. A quota that cannot recover within the deadline returns an actionable message and Retry-After; the source remains saved. Provider allowances are not bypassed.

The 30-question product cap is removed from practice-test configuration and its API contract. Written-test API generation also accepts larger counts. A technical integer bound remains. Very large tests still take longer; this synchronous flow is not a durable background queue. The scheduler is process-local and requires distributed coordination before horizontal scaling.

Owners can delete practice tests after confirmation. Server-side ownership is included in the delete query; foreign keys delete practice attempts atomically. Uploaded materials remain. This does not delete official school assessments or written exams. No database migration is required.

Local verification: 81 policy tests; upload/extraction/generation integration with synthetic provider responses; unauthenticated and cross-owner deletion rejection, cascading attempt deletion and source preservation; Learner Success integration; workspace TypeScript and production builds; built-SPA browser checks including cancellation/confirmation of deletion, mobile layout and selected accessibility rules. The first browser run started before the build was available; the subsequent completed-build run passed.

Hosted checks and live provider/deployment evidence are recorded in the pull request. Existing release limitations in LEARNER_SUCCESS_RELEASE.md remain applicable. This update is not evidence that every possible file or unlimited provider capacity is supported.
