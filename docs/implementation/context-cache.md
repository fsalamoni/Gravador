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

## Current package objective

- Evolve Phase 3 from initial contract scaffold to actual FFmpeg processing execution path and edited media publication.

## Immediate next contracts to lock

- Worker/queue execution contract that transitions audio edit versions from `queued` to `ready/failed`.
- Published edited media path contract and signed playback source switching guarantees.
- Notification contract for audio edit pipeline state transitions.
