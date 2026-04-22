# Risk And Rollout Notes

## Package: audio hardening + notifications/integrations bridge (2026-04-22)

### Risks

- Partial adoption risk: legacy recording documents may miss lifecycle/retention fields.
- Access risk: mixed owner/member authorization checks can diverge across old and new routes.
- Artifact drift risk: direct pipeline upserts could overwrite lifecycle metadata if not transactional.
- UX risk: lifecycle operations in detail page can become inconsistent if backend mutation fails silently.
- CI/CD risk: EAS preview workflow output parsing can fail post-build and mark successful mobile builds as failed.
- UX signal risk: parity diagnostics can produce false-positive warnings on sparse/noisy segment timelines.
- Background execution risk: queued audio-edit jobs can accumulate if no worker/cron consumes `kind=audio-editing`.
- Delivery risk: notification providers (WhatsApp Cloud/email webhook) may be unavailable per environment.

### Mitigations applied

- Added resilient default readers in `recording-lifecycle.ts` to normalize missing fields.
- Centralized owner/member recording authorization through `recording-access.ts` for new lifecycle endpoints and run-task route.
- Switched artifact writes (worker + run-task + manual artifact APIs) to transactional upserts with explicit `artifactVersion` and `artifactStatus` updates.
- Added lifecycle panel actions that always re-fetch backend state after artifact mutation.
- Replaced fragile inline `node -e` parser in `.github/workflows/eas-preview.yml` with heredoc Node script and explicit guards for missing fields/output path.
- Extended centralized recording access guard adoption to legacy API routes (chat, shares, trash, reprocess, tags), reducing owner/member authorization drift.
- Added threshold-based parity diagnostics in recording detail (gap/overlap/invalid checks with bounded thresholds) so issues are visible without blocking core playback flows.
- Added deterministic clean-build fallback for Windows (`.next` cleanup + single build run) to avoid intermittent Next.js ENOENT artifact races during overlapping builds.
- Switched audio edit POST flow from inline FFmpeg execution to decoupled job enqueue + internal processing contract (`PATCH /api/recordings/[id]/audio-editing` with `x-gravador-job-secret`).
- Added explicit audio retry/backoff contracts (`attempt`, `maxAttempts`, `nextAttemptAt`) and non-terminal retry state (`retry_scheduled`) before terminal failure.
- Added audio processing observability payloads in job metrics and ffmpeg metadata (duration/error/attempt tracking).
- Added notification event matrix for audio edit state transitions and deterministic no-op behavior when `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=false`.
- Added guided onboarding modals for WhatsApp/email integrations and send/test flows with standardized notification delivery error mapping.
- Added bulk contract hardening to reject unsafe recording IDs (`/`, `\\`, `..`) and regression test coverage.

### Rollback path

1. Disable runtime entry points by rolling back commit `main` to previous known-good revision.
2. Redeploy web via existing CI path (`firebase-hosting.yml`) or manual Cloud Run rollback to prior image tag.
3. Since lifecycle metadata and job metrics changes are additive and backward-compatible, old UI continues to function without data migration.
4. If needed, freeze notification sends by toggling `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=false` and disconnecting integrations.
5. If needed, freeze audio background executor by rotating `INTERNAL_JOBS_SECRET` and pausing runner triggers.

### Remaining concerns

- No dedicated e2e tests for lifecycle transition matrix yet.
- Bulk merge endpoint currently prepares side-by-side comparison/audit only (no final artifact reconciliation execution yet).
- Audio edit jobs require worker/cron consumption policy in staging/prod (`scheduling.nextAttemptAt` honoring).
- Notification provider staging smoke (WhatsApp Cloud + email webhook) still pending environment configuration.
