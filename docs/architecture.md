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

## Theme / Color Skin System

The web app supports **8 color themes** that the user can pick from Settings → Aparência:

| ID        | Label    | Accent color   |
|-----------|----------|----------------|
| terra     | Terra    | Warm orange    |
| oceano    | Oceano   | Navy / cyan    |
| floresta  | Floresta | Green / emerald|
| noite     | Noite    | Charcoal / purple |
| aurora    | Aurora   | Rose-pink      |
| artico    | Ártico   | Cool gray / ice blue |
| vulcao    | Vulcão   | Crimson red    |
| solaris   | Solaris  | Golden         |

### How it works

1. **CSS custom properties** — 11 channelised RGB triplet tokens (e.g. `--color-accent: 243 138 55`) plus 4 auxiliary rgba vars (`--glow1`, `--glow2`, `--selection-bg`, `--accent-shadow`). Defined in `globals.css` under `@layer base` with `[data-theme="<id>"]` selectors.
2. **Tailwind mapping** — `tailwind.config.ts` maps each token to `rgb(var(--color-X) / <alpha-value>)` so opacity modifiers like `bg-accent/10` work.
3. **ThemeProvider** (`components/theme-provider.tsx`) — React context reads from `localStorage('gravador-theme')` on mount, applies `data-theme` attribute to `<html>`, and persists to Firestore via `PUT /api/settings { theme }` on change.
4. **Settings UI** — The "Aparência" tab in `settings-tabs.tsx` shows a responsive grid of theme cards with live swatches + a preview card.
5. **Server sync** — Theme choice is stored in the workspace Firestore document under `theme` field and loaded on first mount for cross-device consistency.

## AI Pipelines

The `@gravador/ai` package exposes **7 AI pipelines**, all executed in parallel via `Promise.allSettled` in the worker:

| Pipeline      | Function          | Output schema                                                      |
|---------------|-------------------|--------------------------------------------------------------------|
| Summary       | `runSummary`      | `{ tldr, bullets[], longform }`                                    |
| Action Items  | `runActionItems`  | `Array<{ text, assignee?, dueDate?, sourceSegmentIds[] }>`         |
| Mind Map      | `runMindmap`      | `{ nodes[], edges[] }` (React Flow compatible)                     |
| Chapters      | `runChapters`     | `Array<{ title, startMs, endMs, summary }>`                        |
| Quotes        | `runQuotes`       | `Array<{ text, segmentId, speakerId, reason }>`                    |
| Sentiment     | `runSentiment`    | `{ overall: number(-1..1), perChapter: Record<string, number> }`   |
| Flashcards    | `runFlashcards`   | `Array<{ q, a }>`                                                  |

Each pipeline uses `generateObject` (Vercel AI SDK) with a Zod schema for type-safe structured output. Results are stored in `recordings/{id}/ai_outputs/{kind}`.

## Security Middleware

`apps/web/src/middleware.ts` implements:

- **Rate limiting** — In-memory per-IP counters: 120 req/min general, 15 req/min for `/api/chat` + `/api/search`. Stale entries evicted every 30s.
- **CSP headers** — `Content-Security-Policy` allowing Firebase, Google APIs, and AI provider domains.
- **CSRF protection** — Origin header verification on mutation requests (POST/PUT/PATCH/DELETE).
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.

## Chat Persistence

Chat messages are stored in Firestore at `recordings/{id}/chat_messages`:

- `GET /api/chat-history?recordingId=X` — Load messages (ordered by `createdAt`, limit 200)
- `POST /api/chat-history` — Persist message pairs (user + assistant) via batch write
- `DELETE /api/chat-history?recordingId=X` — Clear chat history

The `ChatView` component loads history on mount and auto-persists new messages after each assistant response.

## Data Export

`GET /api/export?recordingId=X&format=json|md` exports the full recording data:

- **JSON** — Complete recording object with transcript, segments, all AI outputs, action items
- **Markdown** — Formatted document with summary, action items (checkboxes), chapters, transcript with timestamps, quotes, flashcards
