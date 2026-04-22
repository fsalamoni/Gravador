# Feature Flags

All flags are read from `apps/web/src/lib/feature-flags.ts`.

## Active flags

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FF_WORKSPACE_DOWNLOADS` | `true` | Enables workspace route `/workspace/downloads` and related navigation. |
| `NEXT_PUBLIC_FF_RECORDING_LIFECYCLE_V1` | `false` | Guards upcoming lifecycle schema/API changes for recording artifacts. |
| `NEXT_PUBLIC_FF_AUDIO_EDITING_V1` | `false` | Guards server-side audio editing/versioning features. |
| `NEXT_PUBLIC_FF_NOTIFICATIONS_V1` | `false` | Guards first-wave notification and integration delivery flows. |
| `NEXT_PUBLIC_FF_BULK_OPS_V1` | `false` | Guards advanced bulk delete/merge behaviors, including `/api/recordings/bulk` and merge side-by-side preparation UX. |

## Rollout policy

1. Default new flags to `false` unless the change is already validated in production.
2. Enable per environment in controlled order: local -> staging/preview -> production.
3. Couple flag activation to explicit verification notes in `phase-tracker.md`.
4. Keep fallback behavior deterministic when a flag is disabled.
5. Bulk merge must preserve artifact payloads side-by-side by contract while the flag is active.
