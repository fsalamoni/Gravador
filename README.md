# Gravador

**Open-source AI audio capture + knowledge workspace.** Record ambient audio from your phone with one tap, let AI produce summaries, action items, mind maps, chapters and a searchable chat over every recording, then manage everything from a web workspace. Bilingual PT-BR / EN from day one, cloud or self-host.

> Think of it as an open alternative to Plaud Note Pro — without the hardware lock-in and without a subscription to process your own audio.

## Features

- 🎙️ **One-tap capture** — iOS home-screen widget, Android Quick Settings tile, lock-screen/Control Center shortcuts, Siri & Google Assistant intents.
- 🔇 **Background recording** with persistent notification, live waveform and offline queue.
- 🤖 **AI pipeline** — transcription (Whisper v3 on Groq / OpenAI / local `faster-whisper`), speaker diarization, summary, action items, mind map, chapters, key quotes, sentiment.
- 💬 **Chat with any recording** via RAG (Firestore vector embeddings) with streaming responses.
- 🌐 **Web workspace** — synced transcript player (wavesurfer.js), semantic + keyword search, folders/tags, multi-user workspaces.
- 🔗 **Share** public links with password and expiration, export to PDF / Markdown / DOCX / Notion / Obsidian.
- ☁️ **Cloud connectors** — Google Drive, Dropbox e OneDrive com backup operacional, além de WhatsApp via webhook.
- 🧩 **BYOK** — bring your own OpenAI / Anthropic / Groq / Google keys, or run fully local with Ollama.
- 🐳 **Self-host** via a single `docker compose up` (Firebase emulators + faster-whisper + Ollama).

## Architecture

```
apps/mobile   Expo SDK 52 — iOS + Android
apps/web      Next.js 15 App Router — workspace + landing
packages/core Types, Zod schemas, shared logic
packages/ui   Cross-platform UI primitives
packages/ai   Provider abstraction + pipelines
packages/db   Firebase Admin client + Firestore schema types
packages/i18n PT-BR + EN messages
workers/ai-pipeline  AI processing jobs (Firebase-triggered)
infra/docker  Self-host compose
```

## Quick start

```bash
# Prereqs: Node 22+, pnpm 10+, Firebase CLI, EAS CLI.
pnpm install
cp .env.example .env   # fill Firebase + AI keys
pnpm dev               # web on :3000, Expo dev server
```

For mobile native features (widgets, background recording) build a dev client:

```bash
cd apps/mobile && pnpm eas build --profile development --platform ios
```

For the current Android internal distribution path:

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm mobile:preview
```

The `preview` profile now targets the live backend at `https://anotes.web.app` and the dedicated Firestore database `anotes`. If you want to verify local Expo access first, run `pnpm mobile:whoami`. If you want the public site to expose the latest APK directly, publish the generated EAS artifact URL to the `ANDROID_PREVIEW_URL` runtime variable used by the web deploy.

The live web workspace is Google Auth only. Firebase Authentication must keep the Google provider enabled for both local validation and production access.
The mobile app now also gates access through Google Auth. The Firebase mobile app registrations and the iOS/web OAuth client IDs are already wired. Firebase currently has both the local Android debug SHA and the non-debug SHA `d1da8de8c1a53582915aea1ddb51f8e5392cf35c` registered, and the repo now wires the matching non-debug Android client ID into EAS build profiles. The remaining blocker for an APK from this machine is Expo/EAS authentication.

Run Firestore Emulator-backed route integration evidence locally (requires Java on PATH):

```bash
pnpm test:web:firestore-emulator
```

Self-host everything (no cloud dependency):

```bash
pnpm selfhost:up
```

## Firebase deploy

The web app can now be deployed to Firebase Hosting from this monorepo.

1. Create a Firebase project and Hosting site for the web app.
2. Copy `.firebaserc.example` to `.firebaserc` and replace the placeholder project id.
3. Deploy Firebase platform config locally with `pnpm firebase:deploy:platform`.
4. Wait for composite indexes with `pnpm firebase:wait:indexes -- --project <firebase-project-id> --database anotes` when Firestore indexes changed.
5. Deploy Hosting locally with `pnpm firebase:deploy`.
6. Add the GitHub secrets `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT` to enable the `Firebase Hosting` workflow.
7. Open a pull request to get a preview channel, or push to `main` to publish the live site.

## Android preview + download hub

- The live website now has public routes `/download` and `/docs`.
- `/download` can surface the latest Android APK when the Cloud Run runtime env `ANDROID_PREVIEW_URL` is set.
- The same page also exposes an iOS QR placeholder with the public “Em construção” warning until TestFlight/App Store distribution is ready.
- The GitHub Action `EAS preview` now builds the Android `preview` profile instead of a dev client, matching the immediate test flow.
- `/login` is the single entry point for web access and exchanges only Google-authenticated Firebase sessions for the platform cookie.
- The mobile preview app now blocks protected routes until Firebase Google sign-in succeeds.
- The live web rollout now uses dedicated Gravador infrastructure: Cloud Run `anotes-web`, Firebase Hosting `anotes`, and the isolated Firestore database `anotes`.

## Release workflow

- Development path: feature branch -> pull request -> `main`.
- Required checks: `CI` and, when mobile files change, `EAS preview`.
- Manual one-shot release: run `Release Platform` from GitHub Actions to validate the monorepo, build Android/iOS with EAS and deploy the web stack in one workflow when the required secrets are configured.
- Production web publish: merge to `main` triggers `firebase-hosting.yml`, deploys Firestore indexes/rules/storage, waits for required indexes, then deploys Cloud Run + Hosting rewrite.
- Mobile preview handoff: after `EAS preview`, copy the generated APK artifact URL into the repository variable `ANDROID_PREVIEW_URL`, then re-run or merge the web deploy to expose the build on `/download`. The workflow can now also be triggered manually from GitHub Actions when the Expo token is configured remotely.
- Rollback: redeploy the previous known-good Cloud Run image revision, then re-run the hosting workflow to keep the public routes pinned to the correct service state.

## Integrations

- `/workspace/integrations` now supports real backup sync for Google Drive, Dropbox and OneDrive.
- Each sync uploads the raw audio plus JSON and Markdown exports into the configured folder structure.
- WhatsApp now supports official Meta Cloud API send/receive flow and can still use webhook mode as an optional fallback for custom automations.

## Open-source references

Gravador stands on the shoulders of these projects — see [`docs/credits.md`](docs/credits.md) for what we borrow from each:

- [openplaud/openplaud](https://github.com/openplaud/openplaud) · [landoncrabtree/applaud](https://github.com/landoncrabtree/applaud) · [BasedHardware/omi](https://github.com/BasedHardware/omi)
- [pluja/whishper](https://github.com/pluja/whishper) · [rishikanthc/Scriberr](https://github.com/rishikanthc/Scriberr) · [Meeting-BaaS/transcript-seeker](https://github.com/meeting-baas/transcript-seeker)
- [lodev09/expo-recorder](https://github.com/lodev09/expo-recorder) · [OpenWhispr/openwhispr](https://github.com/OpenWhispr/openwhispr) · [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) · [collabora/WhisperLive](https://github.com/collabora/WhisperLive)

## License

AGPL-3.0-or-later. See [`LICENSE`](LICENSE).
