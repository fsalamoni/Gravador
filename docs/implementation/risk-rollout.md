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
- Recorder delivery risk: browser-side Firebase Storage uploads can intermittently return `storage/unauthorized` (token hydration/rules timing), causing user-visible failure to save recordings.
- Configuration risk: transcription provider/model selections can be saved in partial states (missing model or cloud key), leading to avoidable run-time failures.

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
- Hardened `/api/integrations/sync` contract with explicit payload validation (`mode`, `integrationId`, `limit`) and deterministic `mode=test` scoping to notification integrations only, preventing false-positive storage test acknowledgements.
- Added route-level regression coverage for integrations sync contract (`apps/web/src/app/api/integrations/sync/route.test.ts`) covering invalid input rejection, storage test-mode behavior, and structured failure-code persistence.
- Updated integrations UI to block unsupported test actions for storage providers, reducing operator confusion between test-only notification flows and storage sync flows.
- Upgraded Google deploy actions to Node 24-compatible majors (`google-github-actions/auth@v3`, `google-github-actions/setup-gcloud@v3`) across `firebase-hosting.yml`, `release-platform.yml`, and `firestore-managed-e2e.yml` to mitigate Node 20 deprecation warnings before enforced runtime cutoff.
- Hardened `notifications-smoke.yml` and `audio-edit-runner.yml` with explicit disabled-path summaries plus strict manual-dispatch failure behavior when activation variables are off, reducing false-green operational confirmations caused by silent skipped jobs.
- Hardened `scripts/smoke-notifications.mjs` with provider-readiness enforcement, timeout-safe HTTP probes, safe JSON parsing, and webhook URL validation to reduce flaky/ambiguous smoke outcomes.
- Added bulk contract hardening to reject unsafe recording IDs (`/`, `\\`, `..`) and regression test coverage.
- Added bulk-delete confirmation hardening (`confirmation.expectedCount` + typed phrase `LIXEIRA <count>`) to prevent accidental multi-recording trash actions.
- Added delete-path route regressions in `apps/web/src/app/api/recordings/bulk/route.test.ts` for confirmation mismatch failures and successful trashed transitions.
- Hardened mobile app bootstrap against white-screen deadlocks with auth timeout fallback, startup error boundary, and resilient firebase/i18n initialization guards.
- Added dedicated `workers/ai-pipeline` audio-edit job consumer (`process-audio-edit-jobs.ts`) that claims due jobs and dispatches retry-safe processing calls with `INTERNAL_JOBS_SECRET`.
- Hardened `.github/workflows/eas-preview.yml` to treat Expo monthly Android quota exhaustion as a degraded `quota_blocked` preview status instead of a hard CI failure.
- Quota mitigation path validated in EAS preview run `24804367070` (workflow conclusion `success` with quota warning + summary contract).
- Added scheduled runner workflow `.github/workflows/audio-edit-runner.yml` with batch summary export and configurable failure threshold (`AUDIO_EDIT_RUNNER_MAX_FAILED_DISPATCH`).
- Added notifications smoke workflow `.github/workflows/notifications-smoke.yml` + `scripts/smoke-notifications.mjs` for provider readiness probing (WhatsApp Graph + email webhook).
- Updated deploy/release workflows to propagate `INTERNAL_JOBS_SECRET`, notification provider envs, and feature flags to Cloud Run runtime/build.
- Release verification on commit `6e4e1f0`: `CI` run `24805210132` success, `firebase-hosting` run `24805210127` success, `EAS preview` run `24805231408` success with explicit quota-blocked summary.
- Operational workflow dispatch checks succeeded (`audio-edit-runner` run `24805361685`, `notifications-smoke` run `24805363134`) with expected `skipped` outcomes while activation vars remain disabled.
- Upgraded bulk merge from prepare-only to transactional execute mode (`/api/recordings/bulk`, `mode=execute`) with side-by-side reconciliation (copy missing active artifacts only), execution audit payloads, and version bump only when artifacts are copied.
- Added route-level integration regression tests for merge execute transaction semantics in `apps/web/src/app/api/recordings/bulk/route.test.ts` (copy-on-missing, no-overwrite, and execution audit assertions) using an in-memory Firestore harness.
- Added reusable in-memory Firestore transaction harness (`apps/web/src/test-utils/fake-firestore.ts`) with transform support (`FieldValue.increment` and `serverTimestamp`) to stabilize route-level API integration tests.
- Added route-level integration regression tests for lifecycle transitions (`apps/web/src/app/api/recordings/[id]/lifecycle/route.test.ts`) and artifact transitions (`apps/web/src/app/api/recordings/[id]/artifacts/[kind]/route.test.ts`) covering status/version/metadata invariants and guard rails.
- Added Firestore Emulator-backed route integration suite (`apps/web/src/app/api/recordings/emulator-routes.test.ts`) validating lifecycle transitions, artifact transaction behavior, and workspace access checks against real emulator transaction semantics.
- Added deterministic emulator execution scripts (`apps/web` `test:firestore-emulator` + root `test:web:firestore-emulator`) and wired CI tests job to run emulator coverage with explicit Java runtime setup.
- Emulator-backed CI caught and resolved a lifecycle mutation persistence defect: `apps/web/src/app/api/recordings/[id]/lifecycle/route.ts` now uses Firestore `update(...)` for dot-path field writes instead of `set(..., { merge: true })`, ensuring correct nested lifecycle/version transitions under real Firestore semantics.
- Initial emulator package commit `f4368f2` behaved as expected for defect exposure (`CI` run `24815425692` failure, `pages` run `24815425349` success, `firebase-hosting` run `24815425679` cancelled after superseding hotfix push).
- Hotfix release verification for commit `e0edb97`: `CI` run `24815525379` success (including `pnpm run test:web:firestore-emulator`), `firebase-hosting` run `24815525377` success, `pages` run `24815524886` success.
- Added centralized notification queue writes (`apps/web/src/lib/notification-queue.ts`) and route integration for lifecycle/artifact/audio-edit events under `NEXT_PUBLIC_FF_NOTIFICATIONS_V1`, reducing risk of silent notification-event loss between API response and downstream provider dispatch.
- Added worker-level feature gate enforcement in `workers/ai-pipeline/src/tasks/process-audio-edit-jobs.ts` so audio-edit jobs are not claimed when `NEXT_PUBLIC_FF_AUDIO_EDITING_V1=false`; runner workflow now propagates this flag explicitly.
- Added staged managed-Firestore route validation assets (`apps/web/src/app/api/recordings/managed-routes.test.ts`, `test:web:firestore-managed`, `.github/workflows/firestore-managed-e2e.yml`) to collect production-like transaction evidence without coupling to default CI runtime.
- Hardened deploy preflight warnings by surfacing missing `EMAIL_NOTIFICATIONS_WEBHOOK_TOKEN` when notifications flag is enabled (`firebase-hosting.yml`, `release-platform.yml`).
- Initial managed workflow run `24844398345` failed because the single managed-Firestore test exceeded Vitest's default 5s timeout under real network latency; assertions themselves did not report semantic mismatches.
- Managed route test timeout was raised to `60_000` on hotfix commit `3d7477f`, and staged workflow `Firestore Managed E2E` run `24844650008` completed with success.
- Release closure for commit `6630bf7`: `CI` run `24844354014` success, `pages` run `24844352856` success, `firebase-hosting` run `24844354027` cancelled by superseding timeout hotfix.
- Release closure for commit `3d7477f`: `CI` run `24844621121` success, `firebase-hosting` run `24844621167` success, `pages` run `24844619948` success.
- Workflow runtime hardening package upgraded deprecated setup actions across automation surfaces (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/setup-java@v5`, `pnpm/action-setup@v5`) to avoid Node 20 deprecation churn and preserve deterministic CI diagnostics.
- Runtime hardening release verification for commit `f1264e3`: `CI` run `24845757841` success (attempt 2), `firebase-hosting` run `24845757805` success, `pages` run `24845756522` success.
- CI checkout instability observed during first attempt for `f1264e3` (`RPC failed; HTTP 500` on fetch) was classified as transient GitHub infra failure; rerun passed without repository code changes, preserving confidence in package integrity.
- Docs-sync commit `a18f7db` exposed recurring Pages deployment timeout on GitHub-managed dynamic workflow (`run 24846180263`, attempts 1 and 2 failed in `Deploy to GitHub Pages` with `Timeout reached, aborting!`) while CI remained green.
- Mitigation completed on commit `b17963b`: replaced `legacy` Pages build mode with repository-managed `.github/workflows/pages.yml` (current actions + deploy timeout/error tuning), switched repository Pages config to `build_type=workflow`, and restored Pages to `status=built`.
- Migration closure evidence: `CI` run `24848972653` success, repository-managed `Pages` run `24848972662` success (build+deploy), and superseded dynamic run `24848971863` cancelled during cutover.
- Added recorder upload fallback path via `/api/recordings/upload`: when client upload fails with `storage/unauthorized` (or when client auth user is temporarily unavailable), upload is retried server-side with session authentication and workspace-access validation.
- Local reliability verification after fallback integration: `pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, and `pnpm --filter @gravador/web run build` all green.
- Release verification for commit `631d646`: `CI` run `24812229786` success, `firebase-hosting` run `24812229815` success, `pages` run `24812229219` success, `EAS preview` run `24812235239` success.
- Added transcription UX hardening in web/mobile settings with one-click operational profiles (speed/quality/privacy), readiness scorecards, and save guardrails for empty-model scenarios; this reduces setup ambiguity before transcription execution.
- Added cloud-key readiness hints (Groq/OpenAI) and local endpoint reminders (faster-whisper) directly in settings to lower first-run failure probability.
- Added chat-agent provider/model fallback orchestration (`runAgentTaskWithFallback`) in both synchronous API execution and background worker pipeline, reducing user-visible 500 failures when preferred models/providers are unavailable.
- Added structured-output compatibility fallback (`generateObject` -> `generateText` + strict JSON parse/validation) for models/providers without tool-use/json-schema support.
- Added embeddings robustness: per-agent embed override parity, OpenAI-key-aware fallback to local Ollama embeddings, and clearer UI hints for embedding provider requirements.
- Recalibrated model catalog comparative ratings (including stronger Qwen tiers) and added explicit UX legend clarifying scores are benchmark-based heuristics, not absolute guarantees.
- Added reactive task-completion refresh in recording detail (`router.refresh()` in pipeline task success path), mitigating stale transcript/artifact rendering without manual page reload.
- Added transcript correction API (`PATCH /api/recordings/[id]/transcript`) with version increments and `transcript_revisions` audit records, mitigating inability to correct transcripts and lack of edit traceability.
- Added re-transcription revision logging (`source=retranscribe`) in both web run-task route and worker pipeline, preserving historical diff trail across automated and manual transcript updates.
- Removed global pipeline trigger lock in UI task cards, mitigating user blocking when one generation is in progress and enabling independent parallel retries/re-runs.
- Reworked settings personal catalog rendering to aggregate all selected models across providers, mitigating hidden-model UX regressions caused by provider-card filtering.
- Added explicit embeddings compatibility matrix (all providers + accepted models + support status) to mitigate misconfiguration and unsupported-provider confusion during catalog curation.
- Updated default model action in global catalog to persist both provider and model, mitigating runtime mismatch where a model could be selected under the wrong provider context.
- Extracted settings catalog resolution and embeddings matrix contracts into `apps/web/src/lib/settings-model-catalog.ts`, mitigating future behavior drift from duplicated logic inside UI components.
- Added regression tests for catalog aggregation/fallback and embeddings matrix invariants in `apps/web/src/lib/settings-model-catalog.test.ts`, reducing risk of silent regressions in provider/model selection behavior.
- Local validation after transcription UX package remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- Local validation after AI agent reliability package remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- Local validation after reactive display + transcript edit/history package remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- Local validation after global catalog + embeddings matrix package remained green (`pnpm lint`, `pnpm --filter @gravador/web run typecheck`).
- Local validation after catalog contract extraction + regression tests package remained green (`pnpm lint`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/web run typecheck`, `pnpm --filter @gravador/mobile run typecheck`).
- Local validation after bulk-delete safety hardening package remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- Local validation after integrations sync hardening package remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- Local validation after workflow Node20-deprecation hardening package remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- Local validation after operational smoke/runner guardrails package remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`, plus `scripts/smoke-notifications.mjs` runtime sanity check).
- Release verification for commit `ac6b94f`: `CI` run `24919915820` success, `Pages` run `24919915825` success, `Firebase Hosting` run `24919915814` success, `Firestore Managed E2E` run `24919923253` success (`database_id=anotes`).
- Additional guardrail verification: manual `Notifications Smoke` run `24919974054` succeeded with `smoke-disabled` summary path under `strict=false`, confirming explicit disabled-state observability.
- Release verification for commit `ac8d6c4`: `CI` run `24919485100` success, `Pages` run `24919485092` success, `Firebase Hosting` run `24919485096` success, `Firestore Managed E2E` run `24919545153` success (`database_id=anotes`).
- Firebase Hosting run `24919485096` no longer emits Node 20 deprecation warnings for Google actions after upgrading to `google-github-actions/auth@v3` and `google-github-actions/setup-gcloud@v3`.
- Release verification for commit `baf23be`: `CI` run `24852990874` success, `Pages` run `24852990897` success, `Firebase Hosting` run `24852990941` success.
- Expanded managed-Firestore staged tests to include auth/session/access/error contracts (`401`, `403`, `400`, `404`) for lifecycle and artifact routes, reducing risk that managed runtime diverges from local/emulator authorization behavior.
- Local validation after managed-suite expansion remained green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`).
- Managed verification for expanded auth/runtime matrix completed on commit `ecf7f8b` (`Firestore Managed E2E` run `24854615993` success on `database_id=anotes`) alongside green release workflows (`CI` `24854596037`, `Pages` `24854596023`, `Firebase Hosting` `24854596062`).

### Rollback path

1. Disable runtime entry points by rolling back commit `main` to previous known-good revision.
2. Redeploy web via existing CI path (`firebase-hosting.yml`) or manual Cloud Run rollback to prior image tag.
3. Since lifecycle metadata and job metrics changes are additive and backward-compatible, old UI continues to function without data migration.
4. If needed, freeze notification sends by toggling `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=false` and disconnecting integrations.
5. If needed, freeze audio background executor by rotating `INTERNAL_JOBS_SECRET` and pausing runner triggers.

### Remaining concerns

- Lifecycle/artifact/merge transition coverage now includes in-memory + Firestore Emulator evidence plus strict-pass managed staged auth/session/runtime boundary evidence (`24854615993`); remaining gap is continuous expansion as new route behaviors are added.
- Audio-edit runner workflow exists but still requires environment-level activation (`ENABLE_AUDIO_EDIT_RUNNER`) and missing secret provisioning (`INTERNAL_JOBS_SECRET`) before non-skipped evidence can be collected.
- Notification smoke workflow exists but still requires provider environment activation (`ENABLE_NOTIFICATIONS_SMOKE`) and missing provider secrets (`WHATSAPP_CLOUD_*`, `EMAIL_NOTIFICATIONS_WEBHOOK_*`) for strict-pass evidence.
- Expo Free-plan Android preview capacity remains a delivery constraint; quota reset or paid capacity is needed for uninterrupted APK generation.
- Transcription UX now minimizes misconfiguration risk, but cloud execution still depends on valid BYOK secrets and local execution still depends on a reachable `LOCAL_WHISPER_URL` runtime endpoint.
