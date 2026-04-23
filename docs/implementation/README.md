# Implementation Index

This folder tracks the phased implementation requested for the platform rollout (web + mobile) with strict stability constraints.

## Current stage

- Stage: Phase 1/2/3 delivered + Phase 4/5 hardening bridge expanded (runner/smoke workflows + mobile bootstrap watchdog + deploy/runtime wiring) and Phase 5 merge execution contract delivered (`/api/recordings/bulk` prepare+execute), with integration-level merge execute transaction coverage now added and locally validated
- Focus: operational activation closure (provision missing secrets/variables for runner + notifications smoke), plus Expo capacity plan and broader lifecycle e2e matrix expansion

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
