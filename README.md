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
- ☁️ **Cloud connectors** — Google Drive, Dropbox, OneDrive, Notion.
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

Self-host everything (no cloud dependency):

```bash
pnpm selfhost:up
```

## Firebase deploy

The web app can now be deployed to Firebase Hosting from this monorepo.

1. Create a Firebase project and Hosting site for the web app.
2. Copy `.firebaserc.example` to `.firebaserc` and replace the placeholder project id.
3. Deploy locally with `pnpm firebase:deploy`.
4. Add the GitHub secrets `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT` to enable the `Firebase Hosting` workflow.
5. Open a pull request to get a preview channel, or push to `main` to publish the live site.

## Open-source references

Gravador stands on the shoulders of these projects — see [`docs/credits.md`](docs/credits.md) for what we borrow from each:

- [openplaud/openplaud](https://github.com/openplaud/openplaud) · [landoncrabtree/applaud](https://github.com/landoncrabtree/applaud) · [BasedHardware/omi](https://github.com/BasedHardware/omi)
- [pluja/whishper](https://github.com/pluja/whishper) · [rishikanthc/Scriberr](https://github.com/rishikanthc/Scriberr) · [Meeting-BaaS/transcript-seeker](https://github.com/meeting-baas/transcript-seeker)
- [lodev09/expo-recorder](https://github.com/lodev09/expo-recorder) · [OpenWhispr/openwhispr](https://github.com/OpenWhispr/openwhispr) · [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) · [collabora/WhisperLive](https://github.com/collabora/WhisperLive)

## License

AGPL-3.0-or-later. See [`LICENSE`](LICENSE).
