# Feature Flags

All flags are read from `apps/web/src/lib/feature-flags.ts`.

## Active flags

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FF_WORKSPACE_DOWNLOADS` | `true` | Enables workspace route `/workspace/downloads` and related navigation. |
| `NEXT_PUBLIC_FF_RECORDING_LIFECYCLE_V1` | `false` | Guards upcoming lifecycle schema/API changes for recording artifacts. |
| `NEXT_PUBLIC_FF_AUDIO_EDITING_V1` | `false` | Guards server-side audio editing/versioning features. |
| `NEXT_PUBLIC_FF_NOTIFICATIONS_V1` | `false` | Guards first-wave notification and integration delivery flows. |
| `NEXT_PUBLIC_FF_BULK_OPS_V1` | `false` | Guards advanced bulk delete/merge behaviors, including `/api/recordings/bulk`, typed delete confirmation contract (`LIXEIRA <count>`), and merge side-by-side preparation UX. |

## Rollout policy

1. Default new flags to `false` unless the change is already validated in production.
2. Enable per environment in controlled order: local -> staging/preview -> production.
3. Couple flag activation to explicit verification notes in `phase-tracker.md`.
4. Keep fallback behavior deterministic when a flag is disabled.
5. Bulk merge must preserve artifact payloads side-by-side by contract while the flag is active.
6. Audio editing flows (`/api/recordings/[id]/audio-editing` + lifecycle panel controls) must stay hidden/inert when `NEXT_PUBLIC_FF_AUDIO_EDITING_V1=false`.
7. Audio-edit worker claiming must remain no-op when `NEXT_PUBLIC_FF_AUDIO_EDITING_V1=false` (runner workflow must propagate this flag into worker env).
8. Notification event side effects must enqueue into `notification_queue` only when `NEXT_PUBLIC_FF_NOTIFICATIONS_V1=true`.
9. Integrations sync test mode (`POST /api/integrations/sync`, `mode=test`) must stay restricted to notification channels (`whatsapp`, `email`) to avoid false-positive storage test acknowledgements.

## Activation checkpoints

### Audio editing (`NEXT_PUBLIC_FF_AUDIO_EDITING_V1`)

1. Enable flag in environment vars used by web runtime and `audio-edit-runner.yml`.
2. Confirm `audio-edit-runner` summary reports non-zero scanned/claimed jobs only when the flag is enabled.
3. Verify `/api/recordings/[id]/audio-editing` returns `404` when disabled and operational responses when enabled.
4. Run `ops-activation-audit.yml` with `target=audio-edit` in `strict=true` mode and retain evidence of zero gaps.

### Notifications (`NEXT_PUBLIC_FF_NOTIFICATIONS_V1`)

1. Provision `WHATSAPP_CLOUD_*` and `EMAIL_NOTIFICATIONS_WEBHOOK_*` secrets.
2. Confirm deploy preflight does not emit missing-token warnings.
3. Run `ops-activation-audit.yml` with `target=notifications` in `strict=true` mode and retain evidence of zero gaps.
4. Run `notifications-smoke.yml` in strict mode and retain workflow evidence.
5. Validate `POST /api/integrations/sync` in `mode=test` rejects storage-only requests with `test_mode_unsupported`.

### Transcription readiness (provider contract)

1. Provision at least one transcription path for runtime (`OPENAI_API_KEY`, `GROQ_API_KEY`, or `LOCAL_WHISPER_URL`).
2. Run `ops-activation-audit.yml` with `target=transcription` in `strict=true` mode and retain evidence of zero gaps.
3. Ensure deploy preflight does not emit the warning `No transcription path configured for runtime`.
