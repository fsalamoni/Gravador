# Context Cache

This file captures decisions and assumptions that must survive long implementation threads.

## Locked decisions

- Delivery mode: phased rollout with feature flags.
- Audio editing architecture: server-side FFmpeg + media versioning.
- Data retention: keep original and edited versions until explicit delete.
- Notifications scope: included in first functional wave.
- Bulk merge behavior: preserve artifacts side-by-side (no forced merge).

## Already resolved foundation

- Firestore ownership hotfix is live for workspace-owner recording creation.
- Public download hub exists and is reused as visual baseline.
- Internal workspace downloads route introduced for authenticated users.
- Navigation and command palette now expose internal downloads entry.
- Lint and typecheck are green after this package.
- Canonical recording lifecycle/retention metadata now exists across web, mobile, and integration ingestion paths.
- New lifecycle and artifact APIs exist under `/api/recordings/[id]/lifecycle` and `/api/recordings/[id]/artifacts`.
- Recording detail page now includes a lifecycle panel with archive/trash/restore/version controls and artifact delete/restore actions.
- EAS preview workflow failure root cause identified: shell quoting conflict in `node -e` output parsing (GitHub Actions step writing `GITHUB_OUTPUT`).
- EAS preview workflow patched to use a heredoc Node script with guarded output writes; rerun dispatched for validation.
- Legacy recording routes now use centralized access checks (`getAccessibleRecording`) across chat, shares, trash, reprocess, and tags endpoints.
- Shares listing/revoke flows are now authorization-hardened with workspace access checks.
- Recording detail now includes timeline/waveform parity diagnostics (segment count, first/last segment bounds, duration delta, overlap/gap/invalid alerts).
- Timeline parity computation is now centralized in `apps/web/src/lib/timeline-parity.ts` and covered by unit tests.
- Web package now has a dedicated `test` script (`vitest run`) for parity regression checks.
- Intermittent Next.js Windows build ENOENT on `.next/server/edge-runtime-webpack.js` was mitigated with serialized clean builds.
- Waveform parity computation is now centralized in `apps/web/src/lib/waveform-parity.ts` and covered by tests.
- Edit/version parity contracts are now centralized in `apps/web/src/lib/edit-version-parity.ts` and surfaced in recording detail diagnostics.
- Bulk operations schema contract is versioned in `apps/web/src/lib/bulk-ops.ts` (`schemaVersion: 1`) with explicit merge mode `side_by_side`.
- Bulk merge/delete audit entries are persisted in `recording_bulk_ops` with actor, scope, and preserve strategy metadata.
- Recording detail supports side-by-side artifact comparison for merge preparation via `?mergeWith=<recordingId>`.
- Lifecycle/artifact mutation APIs now expose mapped notification event contracts (`recording.lifecycle.*`, `recording.artifact.*`, `recording.pipeline.updated`).
- EAS preview rerun `24777625944` completed successfully, closing the mobile preview release gate.
- Audio editing v1 now has initial server contracts under `/api/recordings/[id]/audio-editing` for queue/list/rollback flows (flag-gated).
- Recording detail lifecycle panel now surfaces audio version history, active version marker, edit queue action, and rollback action when audio editing flag is enabled.
- Audio version writes enforce retention defaults (`keepOriginal`, `keepEditedVersions`, `manualDeleteOnly`) to preserve original + edited media until explicit deletion.
- Audio editing queue now executes real server-side FFmpeg processing in `/api/recordings/[id]/audio-editing`, publishing versioned media paths and transitioning versions to `ready`/`failed`.
- Successful audio processing now promotes the processed version to `lifecycle.activeAudioVersionId`; failures are persisted in version metadata for UI visibility.
- Audio editing queue now enqueues dedicated background jobs (`kind: audio-editing`) and processing is exposed through a decoupled executor contract (`PATCH /api/recordings/[id]/audio-editing` with internal job secret).
- Audio edit retries now use explicit backoff contracts (`attempt`, `maxAttempts`, `nextAttemptAt`) and terminal/non-terminal failure states (`retry_scheduled` vs `failed`).
- Audio edit observability contract now persists processing duration/error metadata in job metrics and ffmpeg version metadata for traceability.
- Notification matrix now includes explicit audio edit events (`recording.audio_edit.queued|processing|retry_scheduled|completed|failed`).
- Integrations UI now includes guided setup modals for WhatsApp/email and first-wave test/send actions.
- Notification delivery contract now standardizes status/error handling for WhatsApp/email in `integration-sync` + `notification-delivery`.
- Bulk operation contract now rejects unsafe recording IDs (`/`, `\\`, `..`) to harden path isolation assumptions.
- Mobile app startup now hardens auth restore with timeout/error fallback in `apps/mobile/src/features/auth/session.ts`, preventing indefinite loading when `onAuthStateChanged` stalls.
- Mobile root layout now includes `StartupErrorBoundary` and explicit background-task registration warnings to surface startup/runtime failures instead of blank screens.
- Mobile firebase/i18n bootstrap now uses resilient initialization guards (`initializeAuth`/`initializeFirestore` singleton fallback + locale lookup try/catch).
- Worker consumer contract now exists in `workers/ai-pipeline/src/tasks/process-audio-edit-jobs.ts` with due-job claiming (`queued`/`retry_scheduled` + `scheduling.nextAttemptAt`) and retry-safe dispatch to `/api/recordings/[id]/audio-editing`.
- Root operational scripts now expose `worker:audio-jobs:once` and `worker:audio-jobs:loop` for deterministic staging/prod rollout of audio-edit processing.
- EAS preview workflow now degrades gracefully on Expo monthly Android quota exhaustion (`status=quota_blocked`) instead of hard-failing release observability.
- Latest mobile preview validation run `24804367070` completed with success and explicit quota-blocked summary output.
- Latest firebase-hosting deploy run `24804241474` completed with success after mobile/auth hardening release.
- Scheduled audio-edit runner workflow now exists at `.github/workflows/audio-edit-runner.yml` with batch summary outputs and dispatch-failure threshold enforcement (`AUDIO_EDIT_RUNNER_MAX_FAILED_DISPATCH`).
- Notifications provider smoke workflow now exists at `.github/workflows/notifications-smoke.yml` using `scripts/smoke-notifications.mjs` (WhatsApp Graph probe + email webhook reachability/send-test modes).
- Web deploy workflows now propagate feature flags and optional operational secrets (`INTERNAL_JOBS_SECRET`, `WHATSAPP_CLOUD_*`, `EMAIL_NOTIFICATIONS_WEBHOOK_*`) to Cloud Run runtime.
- Release workflow Android/iOS EAS metadata parsing now uses guarded heredoc scripts (no inline `node -e` quoting fragility).
- Mobile startup shell now includes a bootstrap watchdog fallback CTA to avoid perceived white-screen hangs when routing/auth restoration stalls.

## Current package objective

- Activate newly delivered runner/smoke workflows in staging/prod variables and collect strict-pass evidence.

## Immediate next contracts to lock

- Activation contract for `ENABLE_AUDIO_EDIT_RUNNER=true` with first successful scheduled batches recorded in workflow summaries.
- End-to-end strict smoke evidence for notifications (`ENABLE_NOTIFICATIONS_SMOKE=true`, providers configured) with no failed checks.
- Merge execution contract (beyond side-by-side planning) with rollback-safe artifact reconciliation.
