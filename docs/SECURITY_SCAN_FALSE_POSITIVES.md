# Security scanner false-positive record

Gitleaks 8.30.1 was run against the `codex/rag-pipeline-efficiency` history on 16 November 2026. It reported two `generic-api-key` findings. Both were reviewed in source context and are allowlisted by their exact finding fingerprints in `.gitleaksignore`:

- `artifacts/training-platform/src/pages/platform-health.tsx:131` — chart data field for the p95 latency metric. It is a code identifier, not a credential.
- `docs/PLATFORM_GUIDE.md:714` — ordinary prose in the tenant-safe caching guidance, not a credential.

These exact findings are ignored; the scanner still examines the rest of the repository history and current files. Re-review the fingerprints if either line changes. Never add a broad path, rule, or commit exemption to suppress unrelated findings.
