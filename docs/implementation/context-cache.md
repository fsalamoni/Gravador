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

## Current package objective

- Keep repo/docs/state synchronized while moving from Phase 0 package to Phase 1 contracts.

## Immediate next contracts to lock

- Recording lifecycle state machine fields and transitions.
- API contract for artifact create/update/delete/version actions.
- Bulk delete/merge request payload schema and audit strategy.
