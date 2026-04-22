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

## Current package objective

- Complete staging smoke validation for notifications (WhatsApp/email providers configured) and monitor delivery error rates after activation.

## Immediate next contracts to lock

- Worker/cron execution policy for consuming `audio-editing` jobs and honoring `scheduling.nextAttemptAt`.
- End-to-end staging evidence for first-wave notifications with providers enabled.
- Merge execution contract (beyond side-by-side planning) with rollback-safe artifact reconciliation.
