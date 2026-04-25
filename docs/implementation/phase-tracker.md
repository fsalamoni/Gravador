# Phase Tracker

## Status legend

- [ ] not started
- [~] in progress
- [x] completed

## Phase 0 - rollout foundation (current)

- [x] Add workspace-internal downloads route (`/workspace/downloads`).
- [x] Add workspace top navigation entry for downloads (next to settings).
- [x] Add command palette navigation shortcut for downloads.
- [x] Introduce `feature-flags.ts` with initial rollout switches.
- [x] Document feature flags in `.env.example` files.
- [x] Validate with lint + typecheck.

## Phase 1 - recording lifecycle and persistence

- [x] Define canonical per-recording lifecycle schema and retention metadata.
- [x] Add API routes/contracts for explicit artifact lifecycle operations.
- [x] Guarantee robust per-user persistence and ownership enforcement across edits.
- [x] Consolidate recording access checks across chat/shares/trash/reprocess/tags routes.

## Phase 2 - recording detail and artifact UX

- [x] Expand recording detail page for full artifact lifecycle management.
- [x] Add timeline/waveform parity diagnostics in recording detail page.
- [x] Add timeline/progress/waveform parity checks and behavior tests (timeline + waveform + edit/version coverage delivered).
- [x] Implement side-by-side artifact handling for merge operations.
- [x] Add integration-level lifecycle/artifact route transition coverage (archive/trash/restore/version-bump + artifact update/delete/restore invariants).
- [x] Add Firestore Emulator-backed route integration coverage for lifecycle/artifact transitions and workspace access checks.

## Phase 3 - audio editing and enhancement

- [x] Add server-side FFmpeg editing pipeline with versioning (queue/list + processing executor + ready/failed transitions behind flag).
- [x] Keep original + edited media until explicit user deletion (retention defaults + versioned storage publish path).
- [x] Expose safe editing actions with rollback visibility (active version switch on successful processing + rollback controls in lifecycle panel).

## Phase 4 - integrations and communication ops

- [x] Build richer WhatsApp/email setup modals with guided onboarding.
- [x] Add send/test flows for email integration and notification paths (strict sync contract validation for `mode`/`integrationId`/`limit`, storage test-mode guard to prevent false-positive test success, and route-level regression coverage delivered; provider wiring for real delivery remains env-dependent).
- [~] Validate first-wave notification scope end-to-end (contract and deterministic flag behavior validated via API/unit tests; smoke workflow `notifications-smoke.yml` added, awaiting provider activation/strict pass evidence).
- [x] Persist notification event queue contracts for recording lifecycle/artifact/audio-edit transitions (`notification_queue`, status=`pending`, retry metadata fields) when `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=true`.

## Phase 5 - bulk operations and reliability hardening

- [x] Multi-select delete flow with safety constraints and clear confirmations (typed confirmation phrase + expected-count contract + clear success/skip UX messaging, v1 behind `NEXT_PUBLIC_FF_BULK_OPS_V1`).
- [x] Multi-select merge flow with side-by-side artifacts and auditability (prepare + execute path delivered with non-destructive reconciliation and execution audit metadata).
- [x] Add integration-level merge execute transaction regression coverage (API route harness validating copy-on-missing and no-overwrite invariants).
- [x] Add regression checks around permission/auth/path isolation.
- [x] Harden mobile startup/auth bootstrap to prevent blank-screen deadlocks (auth timeout fallback + startup error boundary + resilient firebase/i18n init).
- [~] Add audio-edit job consumer runner (`workers/ai-pipeline`) honoring `scheduling.nextAttemptAt` with retry-safe dispatch; scheduled workflow `audio-edit-runner.yml` delivered, awaiting environment activation.
- [x] Add runner observability/failure thresholds (JSON batch summary + `AUDIO_EDIT_RUNNER_MAX_FAILED_DISPATCH` contract).
- [x] Enforce worker-side audio editing flag guard so job claiming/dispatch is skipped deterministically when `NEXT_PUBLIC_FF_AUDIO_EDITING_V1=false`.
- [x] Stabilize EAS preview CI against Expo quota exhaustion (degraded `quota_blocked` status path + non-failing summary contract).
- [x] Add staged managed-Firestore route validation path (`apps/web/src/app/api/recordings/managed-routes.test.ts` + manual workflow `.github/workflows/firestore-managed-e2e.yml`).
- [x] Expand managed-Firestore staged suite with auth/session/access/error boundary assertions for lifecycle and artifact routes (401/403/404/400 contracts).
- [x] Harden workflow runtime compatibility by upgrading core setup actions to Node 24-targeting majors (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/setup-java@v5`, `pnpm/action-setup@v5`).
- [x] Migrate GitHub Pages delivery from legacy dynamic workflow to repository-managed `pages.yml` (checkout/configure-pages/upload-pages-artifact/deploy-pages on current majors) with extended deploy timeout and retries.
- [x] Harden web recorder upload reliability by adding server-side upload fallback route (`/api/recordings/upload`) and automatic retry path when browser Firebase Storage returns unauthorized/session-race failures.
- [x] Harden transcription provider onboarding UX on web/mobile with one-click profiles, readiness scorecards, and save-time guardrails (model requirement + provider key guidance).
- [x] Harden AI agent execution reliability with provider/model fallback orchestration across web route and worker (`runAgentTaskWithFallback`) for summary/action-items/mindmap/chapters/quotes/sentiment/flashcards.
- [x] Add structured-output fallback path (`generateObject` -> `generateText` + strict JSON schema parse) to handle providers/models without tool-use/json-schema support.
- [x] Fix embeddings resilience and discoverability: honor per-agent embed provider/model overrides, auto-fallback away from OpenAI when key is missing, and clarify embedding provider behavior in UI copy.
- [x] Recalibrate model catalog ratings with realistic comparative heuristics (including stronger Qwen positioning) and explicit transparency note in selection/catalog modals.
- [x] Make recording detail reactive after task completion without manual reload (`router.refresh()` on task completion + server-state sync for task cards), so transcript/artifacts appear automatically.
- [x] Add transcript full-text editing workflow with save endpoint (`PATCH /api/recordings/[id]/transcript`) and visible revision history (`transcript_revisions`).
- [x] Keep transcript change audit trail for both manual edits (`source=manual_edit`) and re-transcriptions (`source=retranscribe`) with version increments.
- [x] Remove global task-start lock in pipeline panel so generation tasks are independent/parallel and each task can be re-run individually after completion.
- [x] Rework personal model catalog UX to be global across providers: provider cards now scope model selection input, while catalog rendering lists all user-selected models regardless of provider.
- [x] Add embeddings compatibility matrix in settings for all providers, explicitly indicating accepted models and current runtime support boundaries.
- [x] Ensure default chat model selection from the global catalog also updates `chatProvider` to the selected model provider, preventing provider/model mismatch.
- [x] Extract settings catalog resolution and embeddings support matrix into reusable lib contracts (`settings-model-catalog.ts`) to reduce UI drift risk.
- [x] Add regression coverage for global catalog semantics and embeddings matrix contracts (`settings-model-catalog.test.ts`).

## Release gating before each phase transition

- [x] Lint/typecheck green.
- [x] Feature flags default reviewed.
- [x] Tracker + context cache updated.
- [x] Risks and rollback path written.
- [x] Mobile preview workflow healthy (EAS preview run 24806015351 for commit `a685f43` completed with success under `quota_blocked` degraded status).
- [x] Web deploy workflow healthy (firebase-hosting run 24806002669 for commit `a685f43` completed with success).
- [x] CI workflow healthy (run 24806002660 for commit `a685f43` completed with success).
- [x] New operational workflows validated syntactically (`audio-edit-runner` run 24805361685 and `notifications-smoke` run 24805363134 dispatched and skipped by activation flags as expected).
- [x] Scheduled runner behavior remains deterministic while activation toggles are absent (`audio-edit-runner` run 24806076695 skipped).
- [x] Local package verification green after lifecycle/artifact route integration-coverage expansion (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Release package commit `631d646` verified end-to-end (`CI` run `24812229786` success, `firebase-hosting` run `24812229815` success, `pages` run `24812229219` success, `EAS preview` run `24812235239` success).
- [x] CI contract now includes Firestore Emulator-backed route integration execution (`pnpm run test:web:firestore-emulator`) with explicit Java setup on runner.
- [x] Emulator-coverage package commit `f4368f2` correctly surfaced a Firestore field-path lifecycle persistence defect (`CI` run `24815425692` failure), which triggered immediate corrective hotfix.
- [x] Hotfix commit `e0edb97` verified end-to-end (`CI` run `24815525379` success including `test:web:firestore-emulator`, `firebase-hosting` run `24815525377` success, `pages` run `24815524886` success).
- [x] Local hardening package validation green after notification queue + runner gate + managed e2e scaffolding (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Hardening package commit `6630bf7` verified with expected supersession behavior (`CI` run `24844354014` success, `pages` run `24844352856` success, `firebase-hosting` run `24844354027` cancelled by timeout hotfix push, managed workflow run `24844398345` failed on default Vitest timeout).
- [x] Managed timeout hotfix commit `3d7477f` verified end-to-end (`CI` run `24844621121` success, `firebase-hosting` run `24844621167` success, `pages` run `24844619948` success, `Firestore Managed E2E` run `24844650008` success).
- [x] Workflow runtime hardening package merged: deprecated Node 20 action warnings removed by upgrading core setup actions across CI/deploy/runner/smoke/managed/release workflows.
- [x] Workflow runtime hardening commit `f1264e3` verified end-to-end (`CI` run `24845757841` success on rerun attempt 2 after transient checkout fetch HTTP 500, `firebase-hosting` run `24845757805` success, `pages` run `24845756522` success).
- [x] Historical docs sync incident `a18f7db` is closed by repository-managed pages migration (`b17963b`), with legacy dynamic timeout path retired.
- [x] Pages migration commit `b17963b` verified with repository-managed workflow mode active (`CI` run `24848972653` success, `Pages` run `24848972662` success, repository Pages `build_type=workflow` and `status=built`; superseded legacy dynamic run `24848971863` cancelled during cutover).
- [x] Local hotfix validation for recorder unauthorized incident completed (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build` all green after fallback route integration).
- [x] Local validation for transcription UX readiness package completed (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Workflow monitoring closure captured on 2026-04-23 (`CI` run `24851165328` success, `Firebase Hosting` run `24851165327` success, `Pages` run `24850067296` success, `Audio Edit Runner` run `24851861930` skipped by disabled activation flags).
- [x] Transcription UX + docs/index/cache package commit `baf23be` verified end-to-end (`CI` run `24852990874` success, `Pages` run `24852990897` success, `Firebase Hosting` run `24852990941` success).
- [x] Local validation for managed-Firestore auth/runtime expansion package completed (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Managed auth/runtime expansion package commit `ecf7f8b` verified end-to-end (`CI` run `24854596037` success, `Pages` run `24854596023` success, `Firebase Hosting` run `24854596062` success, `Firestore Managed E2E` run `24854615993` success on `database_id=anotes`).
- [x] Local validation for AI agent reliability + embeddings/rating realism package completed (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Local validation for reactive artifact display + transcript editing/history + independent parallel task execution package completed (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Local validation for global catalog + embeddings compatibility matrix package completed (`pnpm lint`, `pnpm --filter @gravador/web run typecheck`).
- [x] Local validation for catalog contract extraction + regression tests package completed (`pnpm lint`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/web run typecheck`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Local validation for bulk-delete safety hardening package completed (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- [x] Local validation for integrations sync hardening package completed (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
