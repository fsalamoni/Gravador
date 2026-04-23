# Implementation Index

This folder tracks the phased implementation requested for the platform rollout (web + mobile) with strict stability constraints.

## Current stage

- Stage: Phase 1/2/3 delivered + Phase 4/5 hardening bridge expanded (runner/smoke workflows + mobile bootstrap watchdog + deploy/runtime wiring), with route-level transition coverage reinforced by notification queue contracts, managed-Firestore staged evidence, workflow runtime hardening (core GitHub Actions upgraded off Node 20-targeted majors), and GitHub Pages migration from legacy dynamic mode to repository-managed workflow mode (latest verified release commit `b17963b`)
- Focus: collect strict-pass operational evidence after secret/variable provisioning (`ENABLE_AUDIO_EDIT_RUNNER`, `ENABLE_NOTIFICATIONS_SMOKE`, provider credentials), expand managed-Firestore coverage from route-level staged checks to broader auth/runtime boundaries, and keep mobile distribution capacity constraints explicitly tracked

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
