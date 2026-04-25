# Implementation Index

This folder tracks the phased implementation requested for the platform rollout (web + mobile) with strict stability constraints.

## Current stage

- Stage: Phase 1/2/3 delivered + Phase 4/5 hardening bridge expanded (runner/smoke workflows + mobile bootstrap watchdog + deploy/runtime wiring), with route-level transition coverage reinforced by notification queue contracts, managed-Firestore staged evidence now including auth/session/access/error boundary assertions, workflow runtime hardening (core GitHub Actions upgraded off Node 20-targeted majors plus Google deploy actions moved to `auth@v3`/`setup-gcloud@v3`), repository-managed Pages workflow stabilized, transcription onboarding UX hardening delivered across web/mobile, AI agent execution resilience package delivered (provider/model fallback orchestration + structured-output fallback + embeddings fallback/override parity + rating transparency UX), recording-detail UX upgraded for automatic post-task refresh + transcript correction with revision history, settings UX aligned to a global personal model catalog plus explicit embeddings compatibility matrix backed by centralized catalog contracts/tests, bulk-delete safety hardened with typed confirmation contracts, and integrations sync send/test contract hardened with strict payload validation plus storage test-mode guard/coverage.
- Focus: collect strict-pass operational evidence after secret/variable provisioning (`ENABLE_AUDIO_EDIT_RUNNER`, `ENABLE_NOTIFICATIONS_SMOKE`, provider credentials), preserve/expand managed-Firestore auth/runtime boundary coverage as behaviors evolve, preserve docs/index/cache synchronization after each package, and keep mobile distribution capacity constraints explicitly tracked.

## Files

- `phase-tracker.md`: execution checklist by phase and ownership
- `feature-flags.md`: runtime flags used for progressive activation
- `context-cache.md`: locked decisions, assumptions, and pending contracts
- `risk-rollout.md`: current risks, mitigations, and rollback actions per package

## Update policy

After each completed package:

1. Update phase status and delivery notes.
2. Update context cache with newly locked decisions.
3. Document newly introduced flags and default values.
4. Keep open risks explicit before moving to the next package.
