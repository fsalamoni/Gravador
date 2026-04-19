# Architecture

```
┌──────────────────┐      ┌──────────────────┐
│  Mobile (Expo)   │      │   Web (Next.js)  │
│  • record        │      │  • dashboard     │
│  • widgets/QS    │      │  • transcript    │
│  • offline queue │      │  • AI tabs       │
│  • Firebase SDK  │      │  • chat RAG      │
└────────┬─────────┘      └────────┬─────────┘
         │ Firebase JS SDK          │ Server Components + API routes
         ▼                          ▼
┌─────────────────────────────────────────────────────┐
│   Firebase (dedicated Firestore DB "anotes")      │
│  users · workspaces · recordings · transcripts │
│  segments · ai_outputs · embeddings (vector) │
│  shares · integrations · jobs · usage_events   │
│  Storage: anotes/audio-raw, anotes/audio-proc  │
│  Auth: Firebase Authentication                  │
│  Isolation: no shared collections with psico   │
└────────┬────────────────────┬────────────────────┘
         │ Webhook / job doc  │ findNearest vector search
         ▼                    │
┌──────────────────┐          │
│ AI pipeline job  │          │
│ process-recording│          │
│  1. transcribe   │          │
│  2. summary/ai   │          │
│  3. embed chunks │          │
└────────┬─────────┘          │
         │                    │
         ▼                    │
┌──────────────────────────────┴─────────────┐
│  @gravador/ai — provider abstraction        │
│  cloud: Groq · OpenAI · Anthropic · Google  │
│  local: faster-whisper · Ollama             │
└─────────────────────────────────────────────┘
```

## Package graph

- `@gravador/core`      : shared types, Zod schemas, pure utils
- `@gravador/i18n`      : PT-BR + EN message bundles
- `@gravador/db`        : Firebase Admin client + Firestore document types
- `@gravador/ai`        : providers + pipelines + prompts
- `@gravador/mobile`    : Expo app (Firebase JS SDK)
- `@gravador/web`       : Next.js app (Firebase JS + Admin SDK)
- `@gravador/ai-pipeline`: AI processing worker (Firebase Admin)

## Data flow: recording → knowledge

1. User taps record on iOS widget / Android QS tile → deep-link opens app and starts recorder.
2. Audio saved to local storage; metadata enqueued in AsyncStorage (`@gravador/upload-queue/v1`).
3. Background task drains queue → uploads audio to Firebase Storage `anotes/audio-raw/<workspaceId>/<recId>.m4a`.
4. Upload completes → webhook calls `/api/webhooks/recording-uploaded` on the web app.
5. Web inserts a `jobs` doc in Firestore and worker picks it up for processing.
6. Worker runs the pipeline: transcribe → persist segments → fan-out AI outputs → embed with vectors.
7. `recordings.status` transitions `queued → transcribing → summarizing → embedding → ready`.
8. Web client reads via Server Components; chat uses `/api/chat` with Firestore vector search (findNearest).

## Isolation contract

- Gravador uses the named Firestore database `anotes`.
- Gravador storage objects stay under the `anotes/` prefix.
- Gravador indexes, rules, and runtime envs must not be reused from `psico` or `(default)`.
