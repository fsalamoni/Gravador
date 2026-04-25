# Implementation Index

This folder tracks the phased implementation requested for the platform rollout (web + mobile) with strict stability constraints.

## Current stage

- Stage: Phase 1/2/3 delivered + Phase 4/5 hardening bridge expanded (runner/smoke workflows + mobile bootstrap watchdog + deploy/runtime wiring), with route-level transition coverage reinforced by notification queue contracts, managed-Firestore staged evidence now including auth/session/access/error boundary assertions, workflow runtime hardening (core GitHub Actions upgraded off Node 20-targeted majors plus Google deploy actions moved to `auth@v3`/`setup-gcloud@v3`), operational workflow guardrails strengthened (explicit disabled summaries + strict manual-dispatch failure for disabled runner/smoke toggles), notification smoke probes hardened with provider-readiness enforcement + timeout-safe network behavior, centralized activation-readiness auditing delivered/stabilized via `ops-activation-audit.yml` + `scripts/audit-ops-activation.mjs` (including summary publication hardening after initial shell/yaml defects), CI-level workflow YAML lint guardrail (`pnpm lint:workflows`) to prevent malformed Actions definitions from reaching protected branches, and transcription readiness guardrails expanded across activation audit + deploy preflight warnings.
- Focus: collect strict-pass operational evidence after secret/variable provisioning (`ENABLE_AUDIO_EDIT_RUNNER`, `ENABLE_NOTIFICATIONS_SMOKE`, provider credentials), now with stable activation-audit preflight evidence for notifications/audio/transcription plus workflow-lint prevention for Actions syntax regressions; preserve/expand managed-Firestore auth/runtime boundary coverage as behaviors evolve, preserve docs/index/cache synchronization after each package, and keep mobile distribution capacity constraints explicitly tracked.
- Latest closure evidence: workflow-lint guardrail commit `6aebdb8` is fully verified (`CI` `24932359275`, `Pages` `24932359268`, `Firebase Hosting` `24932359265`, manual `Firestore Managed E2E` `24932364466`, manual `Ops Activation Audit` `24932365170` all success).

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
