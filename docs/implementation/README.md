# Implementation Index

This folder tracks the phased implementation requested for the platform rollout (web + mobile) with strict stability constraints.

## Current stage

- Stage: Phase 1 and Phase 2 delivered; Phase 3 started with audio edit/version contracts and rollback UX scaffold behind flag
- Focus: wire actual FFmpeg execution pipeline to move queued versions into ready/failed and publish edited media paths

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
