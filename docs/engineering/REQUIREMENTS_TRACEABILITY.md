# Requirements Traceability — Initial Baseline

**Snapshot:** 2026-11-14  
**Scope:** Evidence available from repository metadata, a recursive `main` tree, and observed open-PR records. This is an incomplete starting register, not a complete requirements census.

| ID | Requirement | Implementation evidence | Verification evidence | Status | Outstanding work |
|---|---|---|---|---|---|
| REPO-01 | Preserve and extend the existing repository | Existing TypeScript repository; default branch `main`; API server and multiple platform workflow files present | Repository metadata/tree only | IMPLEMENTED BUT UNTESTED | Read all instructions; inspect source; install and test; no replacement architecture. |
| API-01 | API and role/tenant authorization | `artifacts/api-server/src/` contains auth and policy modules | No code review or automated/runtime test recorded | IMPLEMENTED BUT UNTESTED | Review all route authorization and tenant scoping; add/execute negative cross-tenant tests. |
| AI-01 | Safe, useful educational AI and RAG | AI completion/retry/observability modules; open PR [#181](https://github.com/CayelaemJ/Training-and-Development-Hub/pull/181), [#182](https://github.com/CayelaemJ/Training-and-Development-Hub/pull/182) | No evaluation or live integration evidence recorded | PARTIALLY IMPLEMENTED | Review PRs first; validate retrieval, citations, prompt-injection handling, privacy, failures, latency/cost and acceptance thresholds. |
| OBS-01 | Protected, real cross-platform health monitoring | Observability module; PR #182 concerns monitoring | No end-to-end telemetry or authorization proof | PARTIALLY IMPLEMENTED | Confirm data sources, role restrictions, thresholds, retention and platform signal coverage. |
| CI-01 | Automated verification and security checks | `.github/workflows/` includes verify/code-safety and native platform workflow files; `.circleci/` contains config/security script | Workflow definitions present; latest run results/logs not reviewed | IMPLEMENTED BUT UNTESTED | Inspect YAML and recent results; test correctness, runners and artifact retention. |
| WEB-01 | Complete role-based web learning workflows | Not established by tree inventory | None | NOT YET ASSESSED | Map each role and journey to routes/components, tests and accessibility evidence. |
| NATIVE-01 | Android/iOS/Windows release-ready apps | Native verification workflow files exist | No artifact, signing or runtime evidence | NOT YET ASSESSED | Inspect app source; build on appropriate OS; distinguish build, signing and runtime evidence. |
| DATA-01 | Reliable data schema, migrations, tenant isolation and recovery | Not yet inspected | None | NOT YET ASSESSED | Inspect migration history, constraints, indexes, backup/restore and tests. |
| BI-01 | Trustworthy educational analytics | Not yet inspected | None | NOT YET ASSESSED | Define metrics/lineage and validate role/tenant access and calculations. |
| PRIV-01 | Privacy safeguards for minors and regional legal review | Not yet inspected | None | NOT YET ASSESSED | Trace sensitive data flows and AI processing; document POPIA/Botswana legal review gaps without asserting certification. |
| PERF-01 | Evidence-based performance and cost efficiency | Not yet inspected | No baseline measurements | NOT YET ASSESSED | Establish representative synthetic workload and before/after measurements; avoid new paid infrastructure absent approval. |
| DOC-01 | Complete operational and technical documentation | Root README, agent instructions, execution state and multiple `docs/*.md` files appear in tree | Not all documents read | PARTIALLY IMPLEMENTED | Enumerate and read every `.md`/`.mdx`; reconcile old plans with current code; update required engineering docs. |

## Evidence rules

- A path existing is evidence only of file presence, not correctness or completeness.
- Passing builds do not prove signing, runtime, user-flow, security, privacy, or production readiness.
- A checked box, open PR, or workflow file is not completion evidence.
- Record exact test command, environment, result, and CI link before moving an item to **COMPLETE AND VERIFIED**.
- Keep blocked work explicit, identify the external dependency, and continue independent work.
- This register must be expanded after the complete documentation, issues, PRs, source, CI and validation review.