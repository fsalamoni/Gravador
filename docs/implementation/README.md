# Implementation Index

This folder tracks the phased implementation requested for the platform rollout (web + mobile) with strict stability constraints.

## Current stage

- Stage: Phase 1/2/3 delivered + Phase 4/5 hardening bridge expanded (runner/smoke workflows + mobile bootstrap watchdog + deploy/runtime wiring), with integration-level route coverage now expanded across merge execute and lifecycle/artifact transition APIs, now including Firestore Emulator-backed route integration evidence and CI wiring (release-verified on hotfix commit `e0edb97`)
- Focus: operational activation closure (provision missing secrets/variables for runner + notifications smoke), Expo capacity plan, and staged production-like lifecycle/artifact e2e evidence beyond emulator scope

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
