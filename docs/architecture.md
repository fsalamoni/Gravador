# Architecture

```
┌──────────────────┐      ┌──────────────────┐
│  Mobile (Expo)   │      │   Web (Next.js)  │
│  • record        │      │  • dashboard     │
│  • widgets/QS    │      │  • transcript    │
│  • offline queue │      │  • AI tabs       │
│  • TUS upload    │      │  • chat RAG      │
└────────┬─────────┘      └────────┬─────────┘
         │ Supabase JS              │ Server Components + API routes
         ▼                          ▼
┌──────────────────────────────────────────────┐
│          Supabase (Postgres + RLS)           │
│  users · workspaces · recordings · transcripts │
│  segments · ai_outputs · embeddings (pgvector) │
│  shares · integrations · jobs · usage_events   │
│  Storage buckets: audio-raw, audio-processed   │
└────────┬────────────────────┬────────────────┘
         │ Storage webhook    │ RPC match_embeddings / search_segments
         ▼                    │
┌──────────────────┐          │
│ Trigger.dev job  │          │
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
- `@gravador/db`        : Drizzle schema + Supabase clients
- `@gravador/ai`        : providers + pipelines + prompts
- `@gravador/mobile`    : Expo app
- `@gravador/web`       : Next.js app
- `@gravador/ai-pipeline`: Trigger.dev worker

## Data flow: recording → knowledge

1. User taps record on iOS widget / Android QS tile → deep-link opens app and starts recorder.
2. Audio saved to local storage; metadata enqueued in AsyncStorage (`@gravador/upload-queue/v1`).
3. Background task drains queue → uploads audio to `audio-raw/<workspaceId>/<recId>.m4a`.
4. Supabase Storage webhook calls `/api/webhooks/recording-uploaded` on the web app.
5. Web inserts a `jobs` row and triggers `process-recording` via Trigger.dev.
6. Worker runs the pipeline: transcribe → persist segments → fan-out AI outputs → embed.
7. `recordings.status` transitions `queued → transcribing → summarizing → embedding → ready`.
8. Web client reads via Server Components with RLS; chat uses `/api/chat` with pgvector RAG.
