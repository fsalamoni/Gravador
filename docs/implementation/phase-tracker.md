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
- [~] Add send/test flows for email integration and notification paths (test + send APIs and UI actions delivered; provider wiring remains env-dependent).
- [~] Validate first-wave notification scope end-to-end (contract and deterministic flag behavior validated via API/unit tests; smoke workflow `notifications-smoke.yml` added, awaiting provider activation/strict pass evidence).
- [x] Persist notification event queue contracts for recording lifecycle/artifact/audio-edit transitions (`notification_queue`, status=`pending`, retry metadata fields) when `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=true`.

## Phase 5 - bulk operations and reliability hardening

- [~] Multi-select delete flow with safety constraints and clear confirmations (v1 behind `NEXT_PUBLIC_FF_BULK_OPS_V1`).
- [x] Multi-select merge flow with side-by-side artifacts and auditability (prepare + execute path delivered with non-destructive reconciliation and execution audit metadata).
- [x] Add integration-level merge execute transaction regression coverage (API route harness validating copy-on-missing and no-overwrite invariants).
- [x] Add regression checks around permission/auth/path isolation.
- [x] Harden mobile startup/auth bootstrap to prevent blank-screen deadlocks (auth timeout fallback + startup error boundary + resilient firebase/i18n init).
- [~] Add audio-edit job consumer runner (`workers/ai-pipeline`) honoring `scheduling.nextAttemptAt` with retry-safe dispatch; scheduled workflow `audio-edit-runner.yml` delivered, awaiting environment activation.
- [x] Add runner observability/failure thresholds (JSON batch summary + `AUDIO_EDIT_RUNNER_MAX_FAILED_DISPATCH` contract).
- [x] Enforce worker-side audio editing flag guard so job claiming/dispatch is skipped deterministically when `NEXT_PUBLIC_FF_AUDIO_EDITING_V1=false`.
- [x] Stabilize EAS preview CI against Expo quota exhaustion (degraded `quota_blocked` status path + non-failing summary contract).
- [x] Add staged managed-Firestore route validation path (`apps/web/src/app/api/recordings/managed-routes.test.ts` + manual workflow `.github/workflows/firestore-managed-e2e.yml`).
- [x] Harden workflow runtime compatibility by upgrading core setup actions to Node 24-targeting majors (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/setup-java@v5`, `pnpm/action-setup@v5`).

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
