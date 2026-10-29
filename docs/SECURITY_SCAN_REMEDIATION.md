# Security scanner remediation — 26 October 2026

## Scope and risks

This phase repairs the failing CircleCI scanner installer and addresses its dependency and workflow findings. No database migration or production configuration change is included. The Zod major upgrade affects request/response validators; Orval generation is configured for the same major and HTTP integration tests exercise owner/tenant isolation and malformed input rejection.

- Trivy installer is pinned to v0.76.0 and uses the supported positional version argument.
- Gitleaks 8.30.1 archive is checked against its published SHA-256 before extraction. CI secret scanning uses the binary without a GitHub API token.
- Workflow actions are pinned to resolved upstream commit IDs. Dependabot update cooldown and pnpm release-age, registry-source and publishing-trust safeguards are enabled. Exact existing pino/chokidar versions are excluded from publishing-trust comparison because they predate provenance; this does not exempt future versions or dependency vulnerability scans.
- body-parser 2.4.0 and Zod 4.6.6 replace the versions reported by Trivy (CVE-2026-111181 and CVE-2023-54404). Only the exact body-parser patch is exempt from release-age delay.
- Plain JSX ampersands are escaped so source parses fully. Windows packaging moved unchanged to a PowerShell file to avoid a Semgrep embedded-shell parser failure.

## Reviewed static-analysis exceptions

The two nativeAuth redirects always use a local login URL or a nativeRedirect allowlist entry. Query values are encoded, and the callback state is validated. The Android launcher must be exported; NativeApi.complete rejects callback scheme/host/path mismatches, compares saved state and performs a PKCE exchange. These three statements have rule-specific inline annotations; there is no repository-wide rule exclusion.

## Local validation

- 170 API policy regression tests passed, zero skipped.
- Frozen pnpm installation, full TypeScript checks and production build passed.
- Learner-support, upload and lifelong-passport HTTP/PGlite integration suites passed, including owner/tenant isolation, malformed input, migration replay, three-layer evidence separation and human-review revocation.
- Semgrep: zero findings and zero parsing/matching errors.
- Gitleaks: no secrets found in Git history.
- Trivy: no high/critical findings after lockfile refresh.
- Browser/native CI results must be checked on the final pushed head before merge.

## Release and rollback

Keep production/country/employer/human-review pilots disabled. Active scanners require an explicitly configured owned staging target; skipped scans are not reported as passed. Required CI must pass before merging. Rollback is a reviewed revert of this code/configuration phase; do not silently reintroduce vulnerable dependency versions.
