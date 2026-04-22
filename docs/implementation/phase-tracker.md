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

- [~] Expand recording detail page for full artifact lifecycle management.
- [x] Add timeline/waveform parity diagnostics in recording detail page.
- [~] Add timeline/progress/waveform parity checks and behavior tests (timeline unit coverage added; waveform/edit flows pending).
- [ ] Implement side-by-side artifact handling for merge operations.

## Phase 3 - audio editing and enhancement

- [ ] Add server-side FFmpeg editing pipeline with versioning.
- [ ] Keep original + edited media until explicit user deletion.
- [ ] Expose safe editing actions with rollback visibility.

## Phase 4 - integrations and communication ops

- [ ] Build richer WhatsApp/email setup modals with guided onboarding.
- [ ] Add send/test flows for email integration and notification paths.
- [ ] Validate first-wave notification scope end-to-end.

## Phase 5 - bulk operations and reliability hardening

- [ ] Multi-select delete flow with safety constraints and clear confirmations.
- [ ] Multi-select merge flow with side-by-side artifacts and auditability.
- [ ] Add regression checks around permission/auth/path isolation.

## Release gating before each phase transition

- [x] Lint/typecheck green.
- [x] Feature flags default reviewed.
- [x] Tracker + context cache updated.
- [x] Risks and rollback path written.
- [~] Mobile preview workflow healthy (parser hotfix live; rerun 24777625944 in progress).
