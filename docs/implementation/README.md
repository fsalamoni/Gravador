# Implementation Index

This folder tracks the phased implementation requested for the platform rollout (web + mobile) with strict stability constraints.

## Current stage

- Stage: Phase 1/2/3 delivered + Phase 4/5 hardening bridge expanded (runner/smoke workflows + mobile bootstrap watchdog + deploy/runtime wiring), with route-level transition coverage reinforced by notification queue contracts, managed-Firestore staged evidence including auth/session/access/error boundary assertions, workflow/runtime guardrails stabilized, and current hardening package extending transcription reliability via runtime provider fallback plus resilient local emulator execution.
- Focus: publish and monitor this reliability package end-to-end while continuing operational activation for at least one production transcription path (`OPENAI_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `LOCAL_WHISPER_URL`).
- Latest closure evidence: local validation for the reliability package is green (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @gravador/web run test`, `pnpm --filter @gravador/web run build`, `pnpm --filter @gravador/mobile run typecheck`, `pnpm run test:web:firestore-emulator` with Java fallback + automatic port selection).

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
