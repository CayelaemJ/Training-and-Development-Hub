# Pull request inventory — 2026-11-22

**Source:** git only. `refs/pull/*/head` fetched anonymously from the public repository at main `5a30e1c9bbcf44d9e2f3d8c17f41b9109316061f`.

**Limitation:** the GitHub API was not reachable from this session (CLI token invalid; connector cannot read an unattached repository). PR state (open/closed/draft), base branch, CI status, review comments and mergeability are therefore **not known** and are not claimed. A PR listed as "not provable in main" may be open, closed without merge, merged into a non-main base (e.g. a pilot branch), or merged and later edited on main so its diff no longer reverse-applies. Verify each against GitHub before acting.

Classification method: (1) PR head is an ancestor of main; else (2) a main commit message references `#N`; else (3) the PR diff from its merge-base reverse-applies cleanly onto main; else not provable.

| Count | Classification |
|---:|---|
| 71 | Not provable in main |
| 67 | Squash-merged (main commit cites #N) |
| 25 | Merged (head is ancestor of main) |
| 9 | Content present in main (diff reverse-applies) |

## PRs whose content could not be proven in main

Grouped to support consolidation. "Behind" is how many main commits have landed since the PR branched.

### Dependency update

| PR | Last commit | Head | Branch | Latest commit subject | Evidence |
|---:|---|---|---|---|---|
| #53 | 2026-10-23 | `01bb6ad48` | `build(deps): bump the routine-nonmajor group with 48 updates` |  | Not provable in main — files 9,base =161 commits behind |
| #54 | 2026-10-29 | `bdfa5140f` | `dependabot/npm_and_yarn/pino-http-11.0.0` | fix(deps): lock Pino 10 for pino-http 11 | Not provable in main — files 2,base =161 commits behind |
| #94 | 2026-10-26 | `197256913` | `build(deps): bump the routine-nonmajor group across 1 directory with 49 updates` |  | Not provable in main — files 9,base =94 commits behind |
| #161 | 2026-11-02 | `efc4c836e` | `build(deps): bump @vitejs/plugin-react from 5.2.0 to 6.1.2` |  | Not provable in main — files 2,base =28 commits behind |
| #166 | 2026-11-09 | `ad7890500` | `build(deps): bump @vitejs/plugin-react from 5.2.0 to 6.2.1` |  | Not provable in main — files 2,base =28 commits behind |
| #190 | 2026-11-16 | `6a72a6800` | `dependabot/npm_and_yarn/routine-nonmajor-884df33ad3` | build(deps): bump the routine-nonmajor group with 55 updates | Not provable in main — files 9,base =9 commits behind |
| #191 | 2026-11-16 | `afc199170` | `dependabot/npm_and_yarn/typescript-6.0.3` | build(deps-dev): bump typescript from 5.9.3 to 6.0.3 | Not provable in main — files 2,base =9 commits behind |
| #192 | 2026-11-16 | `7a5503c67` | `dependabot/npm_and_yarn/framer-motion-14.11.1` | build(deps): bump framer-motion from 12.43.0 to 14.11.1 | Not provable in main — files 2,base =9 commits behind |
| #193 | 2026-11-16 | `833f5d70a` | `dependabot/npm_and_yarn/types/node-26.6.6` | build(deps): bump @types/node from 25.9.6 to 26.6.6 | Not provable in main — files 2,base =9 commits behind |

### Documentation

| PR | Last commit | Head | Branch | Latest commit subject | Evidence |
|---:|---|---|---|---|---|
| #65 | 2026-10-26 | `188e6b11b` | `docs/cabo-platform-identity-20261026` | docs: link docs/API_POTENTIAL.md to canonical CABO identity | Not provable in main — files 18,base =160 commits behind |
| #68 | 2026-10-26 | `e8fcf2685` | `fix/za-bw-school-data-release-gate-20261026` | docs/test: enforce explicit opt-in country pilot activation | Not provable in main — files 9,base =146 commits behind |
| #73 | 2026-10-26 | `25ff739ab` | `docs/render-native-test-setup` | Replace obsolete Railway testing guide with current Render setup | Not provable in main — files 74,base =167 commits behind |
| #76 | 2026-10-26 | `e0f7d2012` | `docs/guardian-staging-status` | Record deployed guardian authorization status | Not provable in main — files 76,base =167 commits behind |
| #78 | 2026-10-26 | `f7d3d453c` | `docs/render-runbook-main` | Add Render native testing guidance | Not provable in main — files 18,base =132 commits behind |
| #80 | 2026-10-26 | `3dcbf9a6d` | `docs/render-runbook-main-current` | Add Render test guidance to main | Not provable in main — files 18,base =130 commits behind |
| #89 | 2026-10-26 | `36b75623a` | `security/csrf-oidc-origin-hardening-20261026` | docs(auth): use Render terminology for test secrets | Not provable in main — files 4,base =105 commits behind |
| #91 | 2026-10-26 | `32b2ef63e` | `docs/current-phase-checkpoint-20261026` | Record merged Android emulator validation | Not provable in main — files 1,base =98 commits behind |
| #93 | 2026-10-26 | `4ecabd799` | `docs/phase-checkpoint-after-passport-rebase-20261026` | docs: update execution checkpoint after phase validation | Not provable in main — files 1,base =96 commits behind |
| #170 | 2026-11-13 | `c3170c51e` | `ci/self-hosted-native-platform-checks-20261112` | docs(ci): clarify native runner split and test coverage | Not provable in main — files 79,base =167 commits behind |

### Feature / other

| PR | Last commit | Head | Branch | Latest commit subject | Evidence |
|---:|---|---|---|---|---|
| #20 | 2026-10-18 | `d10852d88` | `ci/circleci-independent-checks-20261016` | ci: align CircleCI Node runtime and build environment with passing GitHub verification | Not provable in main — files 2,base =300 commits behind |
| #34 | 2026-10-16 | `5c2ab9292` | `feature/cabo-assessment-paper-assembly` | ci: include assessment-paper moderation regression tests | Not provable in main — files 7,base =184 commits behind |
| #41 | 2026-10-22 | `2face7a26` | `feat/multi-platform-app-packaging` | fix(native): narrow approved identity hosts and handle offline navigation | Not provable in main — files 16,base =167 commits behind |
| #44 | 2026-10-22 | `d1c145a94` | `feat/lifelong-passport-foundation-20261022` | security(passport): gate human verification on institution and learner safeguards | Not provable in main — files 24,base =167 commits behind |
| #92 | 2026-10-26 | `6acb2a6bf` | `feat/lifelong-passport-rebased-20261026` | feat: rebase lifelong passport foundation on current main | Not provable in main — files 24,base =96 commits behind |
| #95 | 2026-10-27 | `748e862b6` | `feat/groq-hf-balanced-ai-routing` | test(ai): rehearse real synthetic exam generation and grading end-to-end using Groq | Not provable in main — files 17,base =94 commits behind |
| #96 | 2026-11-21 | `993860149` | `feature/admissions-mobility-trust-foundation-20261027` | fix(admissions): fail closed on unsupported jurisdiction inputs | Not provable in main — files 9,base =94 commits behind |
| #105 | 2026-11-21 | `6e2905ba4` | `chore/cloudflare-direct-upload-20261028` | fix(auth): preserve mounted OIDC callback path | Not provable in main — files 10,base =168 commits behind |
| #110 | 2026-10-29 | `5cb52e96e` | `feat/cloudflare-django-learning-worker` | test(security): reject SSRF and credential exfiltration through Django worker URL | Not provable in main — files 17,base =58 commits behind |
| #141 | 2026-11-21 | `b8617330b` | `feat/cloudflare-learning-hub-full-stack-20261029` | fix(cloudflare): expose migration gate blockers | Not provable in main — files 56,base =168 commits behind |
| #165 | 2026-11-21 | `f6f5e6515` | `feat/r2-ai-knowledge-foundation-20261109` | test(r2): correct empty-filename regression coverage | Not provable in main — files 7,base =28 commits behind |
| #178 | 2026-11-21 | `c21f9727d` | `feat/bi-attendance-quality-baseline-20261113` | fix(ui): close attendance response type | Not provable in main — files 5,base =8 commits behind |
| #180 | 2026-11-13 | `9b2066821` | `feat/ai-groq-hf-routing-refresh` | test(ai): restore feature flags after reverse failover test | Not provable in main — files 15,base =20 commits behind |
| #181 | 2026-11-13 | `4856d9cc7` | `feat/rag-lexical-retrieval-foundation-20261113` | test(rag): map isolated Postgres select row counts correctly | Not provable in main — files 10,base =28 commits behind |
| #187 | 2026-11-21 | `9e4fae6ee` | `agent/ai/rag-quality-evaluation` | fix(rag-eval): exclude cross-tenant hits from recall | Not provable in main — files 17,base =28 commits behind |

### Native apps

| PR | Last commit | Head | Branch | Latest commit subject | Evidence |
|---:|---|---|---|---|---|
| #49 | 2026-10-23 | `ae3e3dd38` | `feat/native-ci-test-bundles` | ci(ios): export non-distributable simulator test app for device-layout QA | Not provable in main — files 2,base =163 commits behind |
| #86 | 2026-10-26 | `0bae5ddda` | `test/android-emulator-native-ui-20261026` | Use stable semantics collection assertions in Android tests | Not provable in main — files 4,base =105 commits behind |
| #112 | 2026-10-28 | `9f35fc398` | `feat/android-material-upload-demo` | Add authenticated Android study material uploads | Not provable in main — files 8,base =69 commits behind |
| #113 | 2026-10-28 | `e5f2e3807` | `feat/android-material-upload-complete` | Fix complete Android activity source in upload change | Not provable in main — files 8,base =69 commits behind |
| #114 | 2026-10-28 | `8dd5ba9c5` | `feat/android-offline-support-drafts` | Wire saved draft actions into learner support view | Not provable in main — files 8,base =65 commits behind |
| #115 | 2026-10-29 | `57167df0d` | `feat/android-cabo-demo-brand-polish-20261029` | Fix Android support demo flow assertion | Not provable in main — files 7,base =64 commits behind |
| #129 | 2026-10-29 | `cd5f58ff2` | `feat/native-support-lifecycle-20261029` | fix(android): preserve Box import in PR merge build | Not provable in main — files 7,base =55 commits behind |
| #134 | 2026-10-29 | `018ce99fa` | `feat/native-learner-support-feedback` | Add native learner support request detail and feedback | Not provable in main — files 10,base =53 commits behind |
| #150 | 2026-10-29 | `a4f9cce3f` | `feat/native-school-operations-phase10` | test(native): scroll timetable row into view | Not provable in main — files 8,base =43 commits behind |
| #151 | 2026-10-29 | `dfc813bad` | `feat/native-assessment-workflows-phase11` | fix(native): keep assessment navigation expression continuous | Not provable in main — files 8,base =41 commits behind |
| #152 | 2026-10-29 | `a4d012828` | `feat/native-family-notification-consent-phase12` | fix(android): keep parent invitations visible in demo | Not provable in main — files 8,base =40 commits behind |
| #153 | 2026-10-29 | `ecba0e7b4` | `native/phase-13-written-exams` | Scroll exam form controls into view in Android UI test | Not provable in main — files 10,base =39 commits behind |
| #154 | 2026-10-29 | `030e4c595` | `native/phase-14-assigned-exams` | Document assigned exam Android coverage | Not provable in main — files 8,base =38 commits behind |
| #160 | 2026-10-29 | `637d23017` | `native/phase-20-school-progression` | Pass demo state into school operations card | Not provable in main — files 9,base =32 commits behind |
| #169 | 2026-11-12 | `33e6c7588` | `codex/native-admissions-20261112` | test(android): fix admissions and existing Compose assertions | Not provable in main — files 13,base =25 commits behind |

### Pilot-branch backport (base branch unknown)

| PR | Last commit | Head | Branch | Latest commit subject | Evidence |
|---:|---|---|---|---|---|
| #103 | 2026-10-28 | `0bf186f87` | `feat/pilot-redis-free-backport` | feat(pilot): distributed Redis rate limiter with same local thresholds | Not provable in main — files 5,base =168 commits behind |
| #108 | 2026-10-28 | `b67c95e3d` | `feat/pilot-qstash-preview-backport` | feat(pilot): mount disabled signed QStash preview worker without disturbing existing middl | Not provable in main — files 8,base =168 commits behind |
| #111 | 2026-10-28 | `0a02d1530` | `feat/pilot-material-validation` | test(pilot): file magic validation regression suite | Not provable in main — files 12,base =168 commits behind |
| #119 | 2026-10-29 | `113644a36` | `feat/pilot-private-upstash-blob-storage` | fix(pilot): restore trusted host-to-origin helper required by private storage URLs | Not provable in main — files 18,base =168 commits behind |
| #123 | 2026-10-29 | `3b1934563` | `feat/pilot-infra-readiness-blob-audit` | feat(pilot): bring optional Redis readiness and private storage audit to Render pilot | Not provable in main — files 25,base =168 commits behind |
| #128 | 2026-10-29 | `70c278943` | `feat/pilot-safe-error-telemetry` | test(pilot): reject cookie-backed CSRF while preserving native bearer calls | Not provable in main — files 29,base =168 commits behind |
| #135 | 2026-10-29 | `2ebc0b8aa` | `feat/pilot-admin-mfa-assurance` | test(pilot): verify approved OIDC origin and safe return URLs | Not provable in main — files 35,base =168 commits behind |
| #136 | 2026-10-29 | `157d38a4f` | `feat(pilot): backport opt-in transactional notices TRANSACTIONAL_NOTICES_RUNBOOK.md` |  | Not provable in main — files 32,base =168 commits behind |
| #140 | 2026-10-29 | `bc95c4e60` | `feat/pilot-durable-notification-outbox` | feat(pilot): stage disabled encrypted notification outbox, review worker and tests | Not provable in main — files 46,base =168 commits behind |
| #143 | 2026-10-29 | `aa37388dc` | `feat/pilot-consent-notification-authorization` | security(pilot): typed school notification consent and current guardian/support authorizat | Not provable in main — files 52,base =168 commits behind |
| #147 | 2026-10-29 | `ae7230705` | `feat/pilot-notification-preferences-ui` | a11y(notifications): label each school and notice toggle for screen readers | Not provable in main — files 60,base =168 commits behind |
| #149 | 2026-10-29 | `519fe94b4` | `test/pilot-notification-synthetic-postgres` | test(pilot): backport synthetic in-memory outbox and consent migration checks | Not provable in main — files 62,base =168 commits behind |

### Security / fix

| PR | Last commit | Head | Branch | Latest commit subject | Evidence |
|---:|---|---|---|---|---|
| #37 | 2026-10-21 | `2aa91fbcb` | `fix/ai-provider-failover` | Fix provider-wide AI failures repeating across models | Not provable in main — files 3,base =181 commits behind |
| #45 | 2026-10-23 | `c53135c84` | `security/api-rate-limits-20261023` | security: add bounded role-neutral API and AI abuse controls | Not provable in main — files 2,base =167 commits behind |
| #58 | 2026-10-26 | `5c6658ac7` | `fix/learner-cookie-csrf-20261026` | test: cover absent origin, referer fallback and native-client separation | Not provable in main — files 3,base =160 commits behind |
| #59 | 2026-10-26 | `813f6b654` | `fix/oidc-redirect-validation-20261026` | refactor: remove redundant helper module with unresolved Node test import | Not provable in main — files 3,base =160 commits behind |
| #60 | 2026-10-26 | `85e618464` | `fix/native-parent-school-verification-20261026` | Document Render guardian verification rollout | Not provable in main — files 6,base =160 commits behind |
| #71 | 2026-10-26 | `749338790` | `fix/native-test-synthetic-parent-login` | Allow isolated native sign-in for synthetic guardian fixtures | Not provable in main — files 58,base =167 commits behind |
| #72 | 2026-10-26 | `bf3fd9dcd` | `fix/za-bw-scoped-learner-reads-20261026` | test: require school ID for guardian-issued reports instead of legacy unscoped expectation | Not provable in main — files 15,base =146 commits behind |
| #74 | 2026-10-26 | `052b67ff5` | `fix/native-parent-school-verification-render` | Add school-specific guardian authorization regressions | Not provable in main — files 60,base =167 commits behind |
| #75 | 2026-10-26 | `4c8fdf247` | `fix/za-bw-scoped-learner-attendance-20261026` | test and document school-scoped student attendance for ZA/BW | Not provable in main — files 18,base =146 commits behind |
| #81 | 2026-10-26 | `8b3b7bd67` | `security/live-learning-api-rate-limiter-20261026` | fix(security): add early API limiter to the deployed CABO Learning pilot branch | Not provable in main — files 3,base =168 commits behind |

## PRs evidenced as merged or present in main

| PR | Classification | Head | Subject |
|---:|---|---|---|
| #1 | Merged (head is ancestor of main) | `5a35b1b07` | ci: configure required PORT and BASE_PATH in workspace build |
| #2 | Merged (head is ancestor of main) | `55c16552e` | ci: configure required PORT and BASE_PATH in workspace build |
| #3 | Merged (head is ancestor of main) | `e46c1d1a5` | docs: link the full CABO potential engine handbook from repository home |
| #4 | Merged (head is ancestor of main) | `7af48af6e` | docs: record consent access bug, remediation and release gates |
| #5 | Merged (head is ancestor of main) | `8b4e3e8d3` | docs: link lifelong learner phase from documentation indexes |
| #6 | Merged (head is ancestor of main) | `eb37602c4` |  |
| #7 | Merged (head is ancestor of main) | `a23c23ced` | feat: support Groq API for source-grounded written exams and marking |
| #8 | Merged (head is ancestor of main) | `c21676d8c` | test: query Groq accessible models before completion smoke check |
| #9 | Merged (head is ancestor of main) | `b47530b1f` | security(pwa): restrict offline asset cache to bundled assets and icons |
| #10 | Merged (head is ancestor of main) | `fb22552e9` | content: align search and social descriptions with expanded CABO platform |
| #11 | Merged (head is ancestor of main) | `4cf051800` | style(auth): responsive sign-out controls and confirmation page |
| #12 | Squash-merged (main commit cites #N) | `98c626e7c` | fix: Railway-compatible private material upload and processing |
| #13 | Squash-merged (main commit cites #N) | `a9955ab3e` | chore(compliance): preserve docs/legal/TERMS_OF_SERVICE_DRAFT.md |
| #14 | Squash-merged (main commit cites #N) | `181ec125b` | docs: phase attendance, family insights, academic reports and responsible rankings |
| #15 | Squash-merged (main commit cites #N) | `4a82f0218` | feat: preserve docs/SPORTS_AND_EXTRACURRICULAR_DEVELOPMENT.md |
| #16 | Squash-merged (main commit cites #N) | `2a3c09999` | fix(mobile): prevent any role sidebar overflow and constrain tabs to viewport |
| #17 | Merged (head is ancestor of main) | `1d399ec04` | Complete tenant-scoped MLOps evaluation foundation |
| #18 | Squash-merged (main commit cites #N) | `019f3eec4` | security: document local-only Replit sidecar HTTP exception |
| #19 | Merged (head is ancestor of main) | `b47f5f5d4` |  |
| #21 | Squash-merged (main commit cites #N) | `add38e030` | docs: independent headmaster teacher learner parent demo and privacy acceptance gates |
| #22 | Squash-merged (main commit cites #N) | `bde21ce57` | ci: unit test Railway URL without importing unbuilt generated API package |
| #23 | Squash-merged (main commit cites #N) | `ce444f27a` | security: enforce shared guardian report disclosure policy on every request |
| #24 | Squash-merged (main commit cites #N) | `90352ef9e` | docs: report-card two-person approval, immutable snapshot and remaining certification requ |
| #25 | Squash-merged (main commit cites #N) | `5a38e9a0d` | docs: explain new school intelligence APIs and full release gate list |
| #26 | Squash-merged (main commit cites #N) | `8b91eada7` | ci: test timetable collision policy |
| #27 | Squash-merged (main commit cites #N) | `7bc65d8a9` | docs: moderated licensed question bank permissions and official assessment gates |
| #28 | Squash-merged (main commit cites #N) | `d2f482fca` | docs: clarify explicit oversight scope and small-cell aggregation limits |
| #29 | Squash-merged (main commit cites #N) | `f87e2fba0` | docs: candidate academic data portability, privacy and unintegrated university limits |
| #30 | Squash-merged (main commit cites #N) | `bc12a7dd8` | docs: explicit safe CORS configuration for Railway and production hardening limits |
| #31 | Squash-merged (main commit cites #N) | `f02891314` | docs: offline attendance privacy, timetable substitutions, AI fallback and eight release g |
| #32 | Squash-merged (main commit cites #N) | `2fabd49b3` | ui: learner can verify report hash and optional Ed25519 signature in authorised session |
| #33 | Squash-merged (main commit cites #N) | `aa2329456` | fix: actually use canonical recursive JSON serialization for report digests |
| #35 | Squash-merged (main commit cites #N) | `02d4d3929` | assessment: register paper models, route and regression tests |
| #36 | Merged (head is ancestor of main) | `64df109ed` | Fix admissions browser test Playwright context setup |
| #38 | Merged (head is ancestor of main) | `fa322eab7` |  |
| #39 | Merged (head is ancestor of main) | `93d46312e` | Fix large-document generation quotas and add owner test deletion |
| #40 | Merged (head is ancestor of main) | `efe631c2d` | Build CABO installation experience for phones and computers |
| #42 | Squash-merged (main commit cites #N) | `88092cafc` |  |
| #46 | Squash-merged (main commit cites #N) | `71be44597` | test(windows): require secure paged material reader and sign-out privacy |
| #47 | Squash-merged (main commit cites #N) | `8c48a6a24` | test(privacy): check verified guardian access to progress projections |
| #48 | Squash-merged (main commit cites #N) | `84b7db359` | Clarify draft report status |
| #50 | Squash-merged (main commit cites #N) | `7f743526d` | chore(security): enable weekly dependency update PRs |
| #51 | Merged (head is ancestor of main) | `38f4ecda0` | Fix security suite installers, findings and dependency vulnerabilities |
| #52 | Squash-merged (main commit cites #N) | `fd61277e6` | fix(security): correct scanner regex escaping for CircleCI Node execution |
| #55 | Squash-merged (main commit cites #N) | `dfd195386` |  |
| #56 | Squash-merged (main commit cites #N) | `6f36ea9fa` |  |
| #57 | Squash-merged (main commit cites #N) | `dea5bd810` |  |
| #61 | Squash-merged (main commit cites #N) | `1742d068d` | docs: record native CI artifacts and staging blockers |
| #62 | Merged (head is ancestor of main) | `8dd3f56a3` | test: require atomic school-country upsert predicate, not transaction shape |
| #66 | Squash-merged (main commit cites #N) | `0cdf30ecf` | docs: refresh native platform build evidence |
| #67 | Squash-merged (main commit cites #N) | `bc39ed202` | docs: correct isolated staging platform to Render |
| #79 | Squash-merged (main commit cites #N) | `40d8bfee3` | test(security): verify API throttle executes before parsing/auth and preserves health prob |
| #82 | Merged (head is ancestor of main) | `669ff95fd` | security: complete mainline transfer of country-data release schema |
| #83 | Content present in main (diff reverse-applies) | `e6eb5866c` | Revoke fixture on smoke failure |
| #84 | Merged (head is ancestor of main) | `4847a3086` | privacy: complete mainline scoped learner read and client fixes |
| #85 | Merged (head is ancestor of main) | `805cde5ab` | privacy: rebase school-scoped attendance onto merged country-control chain |
| #88 | Content present in main (diff reverse-applies) | `94110d678` | qa: assert no global learner or guardian counters leak from role portal |
| #90 | Merged (head is ancestor of main) | `4b4340843` | test: scope native routes independently; uppercase bypass covered by country-gate hardenin |
| #99 | Merged (head is ancestor of main) | `f863a593d` | Fix Android test build command continuation |
| #100 | Merged (head is ancestor of main) | `3f6888b4a` | Build Android demo APK alongside emulator tests |
| #101 | Squash-merged (main commit cites #N) | `f47f058da` | docs(learning-hub): record verified Neon pgvector and query monitoring extensions |
| #106 | Squash-merged (main commit cites #N) | `368e3facb` | fix: preserve JSON middleware contract and capture raw signed callback locally |
| #109 | Squash-merged (main commit cites #N) | `d10392bff` | security: validate file signatures in signed background preview worker too |
| #116 | Squash-merged (main commit cites #N) | `48b65da3a` | Wire web launch action into role dashboard content |
| #117 | Squash-merged (main commit cites #N) | `6e9b0647f` | Keep iOS study upload compatible with iOS 15 |
| #118 | Squash-merged (main commit cites #N) | `29ef00d1b` | feat(storage): private Upstash Blob pilot adapter with owner-scoped URLs, file checks, quo |
| #120 | Squash-merged (main commit cites #N) | `f9c5851aa` | Keep CABO serif headings compatible with iOS 15 |
| #121 | Squash-merged (main commit cites #N) | `355b49bed` | docs(ops): align audit invocation with installed tsx workspace |
| #124 | Squash-merged (main commit cites #N) | `8b25f3427` | Add native learner journey workflows |
| #125 | Squash-merged (main commit cites #N) | `40e232ab4` | docs: evidence-based identity, messaging and monitoring launch gates |
| #130 | Squash-merged (main commit cites #N) | `1e9e5f682` | test(ci): inspect actual Django deployment job instead of pipeline parameter |
| #132 | Squash-merged (main commit cites #N) | `496d19c3c` | docs(auth): provider-specific MFA setup and fail-closed rollout gates |
| #133 | Squash-merged (main commit cites #N) | `29fd035db` | test(email): classify duplicate event distinctly from successful provider send |
| #137 | Squash-merged (main commit cites #N) | `223eeee06` | Complete native support status and evidence flows |
| #138 | Squash-merged (main commit cites #N) | `c0c2854b0` | fix(android): expose guardian confirmation for UI test |
| #139 | Squash-merged (main commit cites #N) | `a91f3f44b` | docs(notifications): make consent authorizer a technical precondition, not only operationa |
| #142 | Squash-merged (main commit cites #N) | `568f4e1f4` | test(consent): deny future or forged timestamps |
| #144 | Squash-merged (main commit cites #N) | `a3a3bb17f` | fix(android-test): target report rejection reason by id |
| #145 | Squash-merged (main commit cites #N) | `10c5ec2f5` | fix(android-test): scroll lazy list to report content |
| #146 | Squash-merged (main commit cites #N) | `6b8ecc56d` | a11y(notifications): label each school and notice toggle for screen readers |
| #148 | Squash-merged (main commit cites #N) | `a9b7559a2` | test(notifications): use in-range invalid audit action to exercise CHECK constraint |
| #155 | Squash-merged (main commit cites #N) | `60a6f8326` | Match assigned exam label in Android UI test |
| #156 | Squash-merged (main commit cites #N) | `6598ef370` | Match full privacy note in learner passport test |
| #157 | Squash-merged (main commit cites #N) | `b06feaa86` | Scroll native screens to visible test targets |
| #158 | Squash-merged (main commit cites #N) | `9c0535fa9` | Wire Education Command action through Android home |
| #159 | Squash-merged (main commit cites #N) | `4662c9a2d` | Align Android school intelligence assertion with privacy copy |
| #162 | Content present in main (diff reverse-applies) | `5a776d244` |  |
| #167 | Content present in main (diff reverse-applies) | `d524e8a42` | fix(deps): align React plugin with Vite 8 override |
| #168 | Squash-merged (main commit cites #N) | `c0c9b3014` | test(android): use supported semantics assertion |
| #171 | Content present in main (diff reverse-applies) | `a55d274a3` | feat(native): add private Learning Passport |
| #174 | Squash-merged (main commit cites #N) | `3a1673231` | feat(ai): add private learner personalization profile |
| #175 | Squash-merged (main commit cites #N) | `085c1e1d0` | feat(ai): connect learner AI profile settings |
| #176 | Squash-merged (main commit cites #N) | `613e0e449` | Merge latest main into PR #176 |
| #179 | Content present in main (diff reverse-applies) | `d361e44ff` | Merge latest main into attendance quality work |
| #182 | Squash-merged (main commit cites #N) | `21c8892fa` | security: document exact Gitleaks false positives |
| #183 | Squash-merged (main commit cites #N) | `4dfcced34` | Merge latest main into PR #183 |
| #184 | Content present in main (diff reverse-applies) | `a87946040` | Merge latest main into PR #184 |
| #185 | Squash-merged (main commit cites #N) | `69cc383ba` | Merge latest main into PR #185 |
| #186 | Squash-merged (main commit cites #N) | `f8b7cf42b` | Merge latest main into PR #186 |
| #189 | Content present in main (diff reverse-applies) | `e15441704` | Document and allowlist merged dashboard scan false positive |
| #194 | Content present in main (diff reverse-applies) | `1327c7074` | fix(ci): treat unapproved ZAP baseline as an intentional skip |
