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

## Phase 3 - audio editing and enhancement

- [x] Add server-side FFmpeg editing pipeline with versioning (queue/list + processing executor + ready/failed transitions behind flag).
- [x] Keep original + edited media until explicit user deletion (retention defaults + versioned storage publish path).
- [x] Expose safe editing actions with rollback visibility (active version switch on successful processing + rollback controls in lifecycle panel).

## Phase 4 - integrations and communication ops

- [x] Build richer WhatsApp/email setup modals with guided onboarding.
- [~] Add send/test flows for email integration and notification paths (test + send APIs and UI actions delivered; provider wiring remains env-dependent).
- [~] Validate first-wave notification scope end-to-end (contract and deterministic flag behavior validated via API/unit tests; smoke workflow `notifications-smoke.yml` added, awaiting provider activation/strict pass evidence).

## Phase 5 - bulk operations and reliability hardening

- [~] Multi-select delete flow with safety constraints and clear confirmations (v1 behind `NEXT_PUBLIC_FF_BULK_OPS_V1`).
- [x] Multi-select merge flow with side-by-side artifacts and auditability (prepare + execute path delivered with non-destructive reconciliation and execution audit metadata).
- [x] Add regression checks around permission/auth/path isolation.
- [x] Harden mobile startup/auth bootstrap to prevent blank-screen deadlocks (auth timeout fallback + startup error boundary + resilient firebase/i18n init).
- [~] Add audio-edit job consumer runner (`workers/ai-pipeline`) honoring `scheduling.nextAttemptAt` with retry-safe dispatch; scheduled workflow `audio-edit-runner.yml` delivered, awaiting environment activation.
- [x] Add runner observability/failure thresholds (JSON batch summary + `AUDIO_EDIT_RUNNER_MAX_FAILED_DISPATCH` contract).
- [x] Stabilize EAS preview CI against Expo quota exhaustion (degraded `quota_blocked` status path + non-failing summary contract).

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
- [x] Local package verification green after merge execution delivery (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
