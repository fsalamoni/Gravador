# Context Cache

This file captures decisions and assumptions that must survive long implementation threads.

## Locked decisions


- Chat-oriented agents now execute through centralized multi-candidate fallback orchestration (`runAgentTaskWithFallback`) in both `apps/web/src/app/api/recordings/[id]/run-task/route.ts` and `workers/ai-pipeline/src/tasks/process-recording.ts`, retrying only recoverable provider/model routing failures.
- Structured-output tasks now use `packages/ai/src/pipelines/structured-output.ts`: first attempt with `generateObject`, fallback to `generateText` + strict JSON candidate parsing + Zod validation when tool-use/json-schema capabilities are unavailable.
- Embeddings resolution now honors per-agent overrides (`agentModels.embed`) and provider-aware fallback semantics; OpenAI embeddings automatically fall back to Ollama when `OPENAI_API_KEY` is absent, with clearer provider-specific error signaling.
- Model registry ratings were recalibrated to comparative realistic heuristics (including stronger Qwen tiers) and UX now explicitly labels ratings as comparative benchmarks, not absolute guarantees.
- Local verification for this package is green: `pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`.


- Initial package commit `f4368f2` outcomes: `CI` run `24815425692` failed on lifecycle/version assertions; `firebase-hosting` run `24815425679` cancelled by superseding hotfix push; `pages` run `24815425349` succeeded.
- Hotfix commit `e0edb97` closure: `CI` run `24815525379` success (including `pnpm run test:web:firestore-emulator`), `firebase-hosting` run `24815525377` success, `pages` run `24815524886` success.
- Recording lifecycle/artifact/audio-edit routes now enqueue deterministic notification events into `notification_queue` (status=`pending`, attempts/metadata envelope) when `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=true`.
- Notification queue contract is centralized in `apps/web/src/lib/notification-queue.ts` and reused across route handlers to keep payload shape consistent.
- Audio-edit worker now hard-gates batch processing on `NEXT_PUBLIC_FF_AUDIO_EDITING_V1`; when disabled, `processAudioEditJobBatch` returns a zero-impact summary without claiming jobs.
- Scheduled runner workflow now propagates `NEXT_PUBLIC_FF_AUDIO_EDITING_V1` into worker runtime env, keeping workflow-level and worker-level gating aligned.
- Deploy workflows (`firebase-hosting.yml`, `release-platform.yml`) now warn when `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=true` but `EMAIL_NOTIFICATIONS_WEBHOOK_TOKEN` is missing.
- Staged managed-Firestore route validation path now exists via `apps/web/src/app/api/recordings/managed-routes.test.ts`, script `test:web:firestore-managed`, and manual workflow `.github/workflows/firestore-managed-e2e.yml`.
- Initial managed workflow run `24844398345` failed only due default Vitest test timeout (5s) on real Firestore latency; no functional assertion mismatch was detected.
- Managed route test now uses explicit timeout `60_000` (`apps/web/src/app/api/recordings/managed-routes.test.ts`) to accommodate staging network/database variance.
- Commit `6630bf7` outcomes: `CI` run `24844354014` success, `pages` run `24844352856` success, `firebase-hosting` run `24844354027` cancelled by superseding timeout-hotfix push, `Firestore Managed E2E` run `24844398345` failure (timeout-only).
- Commit `3d7477f` closure: `CI` run `24844621121` success, `firebase-hosting` run `24844621167` success, `pages` run `24844619948` success, `Firestore Managed E2E` run `24844650008` success.
- Workflow runtime hardening migrated setup actions to current majors (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/setup-java@v5`, `pnpm/action-setup@v5`) across CI/deploy/release/runner/smoke/managed workflows to remove Node 20 deprecation warnings.
- Workflow runtime hardening commit `f1264e3` closed with `CI` run `24845757841` success (run attempt 2), `firebase-hosting` run `24845757805` success, and `pages` run `24845756522` success.
- First CI attempt for `f1264e3` failed in checkout due transient GitHub fetch infra error (`RPC failed; HTTP 500`, `expected packfile`) with no source-code regression; rerun completed green.
- Docs sync commit `a18f7db` achieved `CI` run `24846181284` success, but dynamic pages run `24846180263` failed (including rerun attempt 2) with repeated `Deploy to GitHub Pages` polling timeout (`Timeout reached, aborting!`).
- Pages automation currently originates from GitHub-managed dynamic workflow path `dynamic/pages/pages-build-deployment` (`build_type: legacy`), so timeout controls and action versions are not repository-editable.
- Mitigation path locked: migrate to repository-managed Pages workflow (`.github/workflows/pages.yml`) using current action majors and explicit deploy timeout/error settings, then switch repository Pages build type from `legacy` to `workflow`.
- Mitigation executed on commit `b17963b`: repository now contains `.github/workflows/pages.yml`, Pages config switched to `build_type: workflow`, and repository Pages status returned to `built`.
- Migration verification evidence: `CI` run `24848972653` success, repository-managed `Pages` run `24848972662` success (`build` + `deploy` jobs green), and legacy dynamic run `24848971863` cancelled during cutover to avoid deployment contention.
- Incident captured (web recorder): browser upload to `anotes/audio-raw/<workspaceId>/<id>.m4a` can fail with Firebase Storage `storage/unauthorized` despite active workspace session, likely from client auth token/rules drift race during upload.
- Mitigation locked: `useWebRecorder` now retries unauthorized uploads through server endpoint `/api/recordings/upload`, and when client auth user is temporarily null it directly uses server upload path instead of failing fast.
- New server contract: `/api/recordings/upload` requires authenticated API session, validates workspace access via `canAccessWorkspace`, stores audio with Admin Storage, and writes canonical `recordings` document with lifecycle/retention defaults.
- Transcription settings UX now includes one-click profiles (`speed`, `quality`, `privacy`) in both web and mobile settings to reduce provider/model decision friction.
- Transcription setup now exposes explicit readiness scorecards (provider, model, key/local readiness) across web/mobile to prevent avoidable runtime misconfiguration.
- Mobile transcription save flow now enforces non-empty model input and returns targeted guidance when cloud provider keys are still missing in workspace settings.
- Monitoring snapshot (2026-04-23): `CI` run `24851165328` success, `Firebase Hosting` run `24851165327` success, `Pages` run `24850067296` success, and scheduled `Audio Edit Runner` run `24851861930` skipped as expected with activation vars disabled.
- Release closure snapshot (commit `baf23be`, 2026-04-23): `CI` run `24852990874` success, `Pages` run `24852990897` success, `Firebase Hosting` run `24852990941` success.
- Managed Firestore staged route suite now covers auth/runtime boundaries beyond transaction semantics: unauthorized session (`401`), forbidden workspace access (`403`), invalid action (`400`), and not-found recording/artifact (`404`) assertions for lifecycle/artifact routes.
- `.github/workflows/firestore-managed-e2e.yml` summary scope now explicitly includes auth/session/access/error boundary coverage in addition to lifecycle/artifact semantics.
- Release closure snapshot (commit `ecf7f8b`, 2026-04-23): `CI` run `24854596037` success, `Pages` run `24854596023` success, `Firebase Hosting` run `24854596062` success, `Firestore Managed E2E` run `24854615993` success (`database_id=anotes`).

- Firestore ownership hotfix is live for workspace-owner recording creation.
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
- Bulk merge now supports explicit execution modes (`prepare` | `execute`) under `/api/recordings/bulk` with non-destructive reconciliation: copy only missing active artifacts from secondary, never overwrite existing primary artifacts.
- Merge execution now persists reconciliation plan summary + copied artifact kinds in `recording_bulk_ops.execution` and stamps merge metadata on both primary/secondary recording documents.
- Recording detail merge comparison now exposes an inline execute action (`MergeExecutionControls`) and a post-merge success banner (`?mergedFrom=<id>&mergeOperationId=<opId>`).
- Route-level integration coverage now exists for merge execute transaction semantics in `apps/web/src/app/api/recordings/bulk/route.test.ts` using an in-memory Firestore transaction harness.
- Web Vitest alias resolution is now explicit in `apps/web/vitest.config.ts` (`@` -> `./src`) for route-level tests importing app-layer modules.
- Reusable fake Firestore test harness now exists at `apps/web/src/test-utils/fake-firestore.ts` with support for transaction flow, dot-path updates, `FieldValue.increment`, and `FieldValue.serverTimestamp` semantics.
- Route-level integration coverage now exists for lifecycle transitions in `apps/web/src/app/api/recordings/[id]/lifecycle/route.test.ts` (archive/trash/restore/version bump, plus auth/validation/not-found guards).
- Route-level integration coverage now exists for artifact-kind transitions in `apps/web/src/app/api/recordings/[id]/artifacts/[kind]/route.test.ts` (update/delete/restore transitions, artifact versioning, lifecycle last-event metadata).
- Firestore Emulator-backed route integration suite now exists at `apps/web/src/app/api/recordings/emulator-routes.test.ts` covering lifecycle transitions, artifact delete/restore/update transactions, workspace-member authorization, and missing-artifact guards against real emulator transaction semantics.
- Root script `test:web:firestore-emulator` now executes `firebase emulators:exec --only firestore "pnpm --filter @gravador/web run test:firestore-emulator"`; `apps/web/package.json` now exposes `test:firestore-emulator`.
- CI tests workflow now provisions Java (`actions/setup-java@v5`) and executes `pnpm run test:web:firestore-emulator` to keep emulator-backed coverage continuously enforced.
- Local emulator execution currently requires Java on PATH; default `pnpm --filter @gravador/web run test` keeps emulator suite skipped unless `FIRESTORE_EMULATOR_HOST` is set.
- Emulator CI surfaced a production-relevant persistence bug in lifecycle mutations: Firestore `set(..., { merge: true })` with dot-path keys did not apply expected nested updates in emulator/production semantics; route `apps/web/src/app/api/recordings/[id]/lifecycle/route.ts` now uses `update(...)` for lifecycle field-path writes.
- Commit `631d646` release verification: `CI` run `24812229786` success, `firebase-hosting` run `24812229815` success, `pages` run `24812229219` success, `EAS preview` run `24812235239` success.
- Commit `a685f43` release verification: `CI` run `24806002660` success, `firebase-hosting` run `24806002669` success, `EAS preview` run `24806015351` success (`quota_blocked` degraded output contract).
- Scheduled `audio-edit-runner` remains gated while activation vars are absent (`24806076695` skipped).
- Repository currently has no `INTERNAL_JOBS_SECRET`, `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `EMAIL_NOTIFICATIONS_WEBHOOK_URL`, `EMAIL_NOTIFICATIONS_WEBHOOK_TOKEN` secrets and no `ENABLE_AUDIO_EDIT_RUNNER` / `ENABLE_NOTIFICATIONS_SMOKE` variables, so strict operational activation is still blocked.
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
- Commit `6e4e1f0` release closure: `CI` run `24805210132` success, `firebase-hosting` run `24805210127` success, `EAS preview` run `24805231408` success (`quota_blocked` degraded output contract).
- New workflows validated on main via manual dispatch: `audio-edit-runner` run `24805361685` skipped by `ENABLE_AUDIO_EDIT_RUNNER=false` and `notifications-smoke` run `24805363134` skipped by `ENABLE_NOTIFICATIONS_SMOKE=false`.

## Current package objective

- Close remaining operational rollout after Phase 5 merge execution + integration coverage delivery: activate runner/smoke workflows in staging/prod variables and collect strict-pass evidence.
- Preserve deterministic managed-Firestore staged coverage for lifecycle/artifact auth/runtime boundaries as the non-emulator release gate.

## Immediate next contracts to lock

- Activation contract for `ENABLE_AUDIO_EDIT_RUNNER=true` with first successful scheduled batches recorded in workflow summaries.
- End-to-end strict smoke evidence for notifications (`ENABLE_NOTIFICATIONS_SMOKE=true`, providers configured) with no failed checks.
- Keep expanding managed route assertions as new lifecycle/artifact behaviors are introduced, preserving explicit auth/session/error boundary checks.
