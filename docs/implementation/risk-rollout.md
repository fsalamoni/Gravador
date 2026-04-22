# Risk And Rollout Notes

## Package: lifecycle contracts + artifact APIs (2026-04-22)

### Risks

- Partial adoption risk: legacy recording documents may miss lifecycle/retention fields.
- Access risk: mixed owner/member authorization checks can diverge across old and new routes.
- Artifact drift risk: direct pipeline upserts could overwrite lifecycle metadata if not transactional.
- UX risk: lifecycle operations in detail page can become inconsistent if backend mutation fails silently.
- CI/CD risk: EAS preview workflow output parsing can fail post-build and mark successful mobile builds as failed.
- UX signal risk: parity diagnostics can produce false-positive warnings on sparse/noisy segment timelines.

### Mitigations applied

- Added resilient default readers in `recording-lifecycle.ts` to normalize missing fields.
- Centralized owner/member recording authorization through `recording-access.ts` for new lifecycle endpoints and run-task route.
- Switched artifact writes (worker + run-task + manual artifact APIs) to transactional upserts with explicit `artifactVersion` and `artifactStatus` updates.
- Added lifecycle panel actions that always re-fetch backend state after artifact mutation.
- Replaced fragile inline `node -e` parser in `.github/workflows/eas-preview.yml` with heredoc Node script and explicit guards for missing fields/output path.
- Extended centralized recording access guard adoption to legacy API routes (chat, shares, trash, reprocess, tags), reducing owner/member authorization drift.
- Added threshold-based parity diagnostics in recording detail (gap/overlap/invalid checks with bounded thresholds) so issues are visible without blocking core playback flows.

### Rollback path

1. Disable runtime entry points by rolling back commit `main` to previous known-good revision.
2. Redeploy web via existing CI path (`firebase-hosting.yml`) or manual Cloud Run rollback to prior image tag.
3. Since lifecycle metadata changes are additive and backward-compatible, old UI continues to function without data migration.
4. If needed, freeze new manual lifecycle actions by temporarily removing nav entry to the panel and restricting endpoints.

### Remaining concerns

- No dedicated e2e tests for lifecycle transition matrix yet.
- Merge-side artifact side-by-side rendering contract still pending Phase 2/5 work.
- Latest EAS preview rerun for parser validation must complete successfully before closing this release gate.
- Dedicated automated behavior tests for parity diagnostics are still pending.
