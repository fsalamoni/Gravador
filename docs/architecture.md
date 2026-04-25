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

### Web recorder (browser)

The web app also supports **in-browser audio recording** via the Web Audio API:

- **Hook**: `useWebRecorder` (`hooks/use-web-recorder.ts`) — wraps `navigator.mediaDevices.getUserMedia` + `MediaRecorder` API.
- **Component**: `WebRecorderButton` (`workspace/recordings/web-recorder-button.tsx`) — client component with mic/stop buttons and live duration display.
- **Flow**: Record → stop → upload blob to Firebase Storage → create Firestore `recordings` doc with status `transcribing` → AI pipeline picks it up automatically.
- **workspaceId**: Resolved server-side by querying Firestore `workspaces` collection (not cookie-based).

## Isolation contract

- Gravador uses the named Firestore database `anotes`.
- Gravador storage objects stay under the `anotes/` prefix.
- Gravador indexes, rules, and runtime envs must not be reused from `psico` or `(default)`.

## Theme / Color Skin System

The web app supports **9 color themes**. **Claro** is the default (light theme); the remaining 8 are dark skins. Users pick from Settings → Aparência.

| ID        | Label    | Accent color   | Mode  |
|-----------|----------|----------------|-------|
| claro     | Claro    | Sky blue       | Light (default) |
| terra     | Terra    | Warm orange    | Dark  |
| oceano    | Oceano   | Navy / cyan    | Dark  |
| floresta  | Floresta | Green / emerald| Dark  |
| noite     | Noite    | Charcoal / purple | Dark |
| aurora    | Aurora   | Rose-pink      | Dark  |
| artico    | Ártico   | Cool gray / ice blue | Dark |
| vulcao    | Vulcão   | Crimson red    | Dark  |
| solaris   | Solaris  | Golden         | Dark  |

### How it works

1. **CSS custom properties** — 11 channelised RGB triplet tokens (e.g. `--color-accent: 243 138 55`) plus 4 auxiliary rgba vars (`--glow1`, `--glow2`, `--selection-bg`, `--accent-shadow`). Defined in `globals.css` under `@layer base` with `[data-theme="<id>"]` selectors.
2. **Tailwind mapping** — `tailwind.config.ts` maps each token to `rgb(var(--color-X) / <alpha-value>)` so opacity modifiers like `bg-accent/10` work.
3. **Bootstrap script** — `app/layout.tsx` injects an inline `<script>` that runs **before hydration**. It reads `localStorage('nexus-theme')`, validates the value against the whitelist, and sets `data-theme` on `<html>`. Missing/unknown values fall back to `claro`. This avoids a FOUC (flash of unstyled content) and ensures Claro renders for first-time visitors.
4. **ThemeProvider** (`components/theme-provider.tsx`) — React context reads from `localStorage('nexus-theme')` on mount (matching the bootstrap key), applies `data-theme` attribute to `<html>`, and persists to Firestore via `PUT /api/settings { theme }` on change.
5. **Settings UI** — The "Aparência" tab in `settings-tabs.tsx` shows a responsive grid of theme cards with live swatches + a preview card. The tab bar itself uses the same card-tile layout (5 cards: Conta, Aparência, Provedores de IA, Agentes, Segurança) to match the platform's visual language.
6. **Server sync** — Theme choice is stored in the workspace Firestore document under `theme` field and loaded on first mount for cross-device consistency.
7. **Mobile default** — `apps/mobile/tailwind.config.js` ships the Claro palette (light bg, dark text, sky-blue accent) as its default, keeping web and mobile visually consistent on first run.

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

## Admin Dashboard

`/workspace/admin` provides a workspace-level analytics dashboard:

- **API**: `GET /api/admin/stats` — Aggregates recording counts, durations, AI pipeline outputs, and member counts from Firestore.
- **KPIs**: Total recordings, ready/failed/processing counts, total audio hours, member count.
- **Charts**: 7-day recording activity bar chart, pipeline outputs breakdown by kind.
- **Security panel**: Summary of active security measures (rate limiting, CSP, CSRF, encrypted keys).

## Soft Delete / Trash

Recordings support soft-delete via the `deletedAt` timestamp field:

- **Soft delete**: `POST /api/recordings/trash { recordingId }` — Sets `deletedAt` to server timestamp.
- **List trash**: `GET /api/recordings/trash` — Returns recordings where `deletedAt != null`.
- **Restore**: `PUT /api/recordings/trash { recordingId }` — Clears `deletedAt` back to `null`.
- **Permanent delete**: `DELETE /api/recordings/trash { recordingId }` — Deletes recording and all subcollections (transcripts, segments, ai_outputs, action_items, embeddings). Only allowed for already-trashed recordings.
- **UI**: `/workspace/recordings/trash` — Card-based trash page with restore and permanent delete buttons.

All listing queries (`listUserRecordings`, search, health check) filter by `deletedAt == null` to exclude trashed recordings.

## Recording Lifecycle Contracts (Phase 1)

Recordings now include additive lifecycle metadata that supports versioning and retention decisions without breaking legacy documents.

- **Recording metadata**:
    - `lifecycle.status`: `active | archived | trashed`
    - `lifecycle.recordingVersion`: monotonic recording version
    - `lifecycle.retainedVersions`: number of retained versions
    - `lifecycle.lastEvent`: lifecycle/audit event marker
    - `retention`: `{ keepOriginal, keepEditedVersions, manualDeleteOnly, purgeAfterDays }`
- **Artifact metadata** (on `ai_outputs/{kind}` docs):
    - `artifactStatus`: `active | deleted`
    - `artifactVersion`: monotonic artifact version
    - `sourceRecordingVersion`: recording version that generated this artifact
    - `updatedAt`, `updatedBy`, `deletedAt`

### Lifecycle and artifact API routes

- `GET /api/recordings/{id}/lifecycle` — returns normalized lifecycle + retention + deletedAt.
- `PATCH /api/recordings/{id}/lifecycle` — actions: `archive | unarchive | trash | restore | bumpVersion`.
- `GET /api/recordings/{id}/artifacts` — lists artifact docs with lifecycle status.
- `POST /api/recordings/{id}/artifacts` — create/upsert artifact payload with version bump.
- `GET/PATCH/POST/DELETE /api/recordings/{id}/artifacts/{kind}` — read/update/restore/delete artifact with lifecycle tracking.
- Authorization model: recording access checks are centralized through `getAccessibleRecording` / `canAccessWorkspace` and reused by lifecycle/artifact/run-task/chat/shares/reprocess/tags/trash routes. Destructive trash operations remain creator-only.

### Recording detail UX integration

- `workspace/recordings/[id]` now renders a lifecycle panel with:
    - archive, unarchive, trash, restore, and version bump actions
    - artifact-level delete/restore controls
    - lifecycle and retained-version indicators
- `workspace/recordings/[id]` also renders parity diagnostics for transcript timeline vs waveform/audio duration:
    - segment count + first-start/last-end markers
    - duration delta between transcript tail and recording duration
    - warning classification for invalid segment bounds, overlaps, and long gaps

## Worker Reliability

The AI pipeline worker (`process-recording.ts`) implements:

- **Exponential backoff**: Each pipeline call is wrapped in `withRetry()` — up to 3 retries with `BASE_DELAY * 2^attempt + jitter` delays.
- **Per-pipeline status**: After fan-out completes, `pipelineResults` (e.g. `{ summary: 'ok', mindmap: 'failed' }`) is stored on the recording document.
- **Graceful degradation**: `Promise.allSettled` ensures one failing pipeline doesn't block others. Only successful outputs are persisted.

## Model Catalog (OpenRouter)

The web app supports a **dynamic model catalog** via OpenRouter's API:

- **API route**: `GET /api/models?provider=openrouter` — fetches **every model** OpenRouter advertises (paid + free, text + multimodal, chat + reasoning) from `https://openrouter.ai/api/v1/models`. No modality filter is applied; the personal-catalog UI is expected to surface the full list so users can curate it themselves.
- **Firestore cache**: Models stored in `model_catalog` collection with 6-hour TTL. Refresh triggered automatically when stale. Upsert keeps all returned entries; removed models are marked `available: false` instead of deleted.
- **Live fallback**: If the Firestore index query fails or the cache is empty, the route falls back to a direct live call to the OpenRouter API and returns the same un-filtered shape (`source: 'openrouter-live'`).
- **Settings UI**: `settings-tabs.tsx` loads the full catalog. When no models are manually selected, **all available models** are shown in agent selection dropdowns. Users can optionally narrow the list via the catalog modal.
- **Agent assignment**: Each AI agent (summary, mindmap, chapters, etc.) can be assigned a specific model from the catalog.

## Transcription Providers

The `transcribe()` function in `@gravador/ai` supports 4 providers:

| Provider              | Model             | Cost              | Notes                                    |
|-----------------------|-------------------|-------------------|------------------------------------------|
| **Groq** (default)    | Whisper Large v3  | ~$0.04-$0.111/h   | Fastest in most workloads (<1x RT)       |
| **OpenAI**            | Whisper-1         | ~$0.006/min audio | No aggressive rate limit                 |
| **ElevenLabs**        | Scribe v2 / v1    | BYOK plan pricing | Strong multilingual + word timestamps    |
| **Local (self-host)** | faster-whisper    | Free              | Requires own GPU                         |

Configuration: `aiSettings.transcribeProvider` + `aiSettings.transcribeModel` in workspace settings. Keys stored in `aiSettings.byokKeys`.

Detailed onboarding (provider registration, API keys, costs, limits, self-host setup):
`docs/transcription-providers.md`.

## CI/CD

- **GitHub Actions CI** (`.github/workflows/ci.yml`): lint (biome) → typecheck (turbo) → workflow YAML lint (`pnpm lint:workflows`) → tests — runs on push to `main` and PRs.
- **Firebase Hosting** (`.github/workflows/firebase-hosting.yml`): Deploys Firestore indexes and hosting on push to `main`.
- **Cloud Build** (`infra/cloudbuild/web.yaml`): Builds Docker image with all `NEXT_PUBLIC_*` env vars baked in, pushes to Artifact Registry.
- **Cloud Run**: Serves the web app at `anotes.web.app` via custom domain mapping. Deployed manually via `gcloud run deploy`.
- **EAS Build** (`.github/workflows/eas-preview.yml`): Builds Android APK on PRs touching mobile code. Manual builds via `eas build --profile preview`.

## Integrations (OAuth + Webhook)

`apps/web/src/app/api/integrations/` implements end-to-end integrations for storage/backup and messaging:

- **OAuth flows** (`connect/route.ts` → `callback/route.ts`): Google Drive, Google Calendar, OneDrive (Microsoft Graph), Dropbox. `connect` builds the provider-specific authorization URL with a base64url-encoded `state` (uid + integrationId + timestamp, 15 min TTL). `callback` validates state, exchanges the code for tokens, fetches the connected account email, and persists `{ status: 'connected', accessToken, refreshToken, scope, connectedEmail, ... }` to `users/{uid}/integrations/{integrationId}`.
- **WhatsApp**: webhook-based (not OAuth). Incoming audio messages are transcribed and stored as recordings owned by the user whose WhatsApp number is linked.
- **Env vars**: `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MICROSOFT_OAUTH_CLIENT_ID/SECRET`, `DROPBOX_OAUTH_CLIENT_ID/SECRET`. `NEXT_PUBLIC_APP_URL` overrides the redirect origin when set.

## Download Page & QR Code

`/download` serves the mobile app download page:

- **Android**: APK hosted on Firebase Storage; displayed with a scannable QR code for one-tap install from a phone camera.
- **iOS**: Marked "em construção" (under construction) — no download link yet, pending TestFlight / App Store submission.
- **QR component** (`components/qr-code.tsx`): Real QR encoding backed by the [`qrcode`](https://www.npmjs.com/package/qrcode) npm package (`QR.toCanvas`, error-correction level M, 1-module margin). Replaced a prior hash-based placeholder that rendered unscannable pixel art.

## Command Palette (⌘K)

A global fuzzy-search command palette accessible via `Cmd/Ctrl+K`:

- **Static commands**: Navigation (home, recordings, search, integrations, settings, admin, trash) + configuration shortcuts.
- **Live recording search**: Queries `/api/recordings/search?q=...` when input has 2+ characters, showing results grouped under "Gravações".
- **Keyboard navigation**: Arrow keys, Enter to select, Escape to close. Grouped by category with visual indicators.
- **Implementation**: `CommandPalette` component rendered inside `workspace-shell.tsx`, replaces old `use-global-shortcuts` Cmd+K → search redirect.

## Multi-Agent Settings (Phase 3.3)

Each AI pipeline agent can be independently configured:

- **Custom prompts**: Per-agent textarea in Settings → Agentes for additional system instructions. Stored as `agentPrompts: Record<string, string>` in workspace settings.
- **Transcription provider**: Dropdown to select Groq Whisper (fast/free), OpenAI Whisper (reference), or Local/self-hosted.
- **Batch reprocessing**: Button in Agentes tab + bulk action in recordings grid. Calls `POST /api/recordings/reprocess` to re-queue selected recordings through AI pipelines.

## Recording Management (Phase 4.1)

Enhanced recording library with organizational and bulk features:

- **Tags**: Array field on recordings. `PUT/POST /api/recordings/tags` for set/merge operations. Tags displayed as colored pills on recording cards.
- **Sort controls**: Client-side sorting by date, title, duration, or status with ascending/descending toggle.
- **Tag filtering**: Click a tag pill in the controls bar to filter the grid.
- **Bulk selection**: Checkboxes on each card, select-all toggle, bulk actions bar (add tag, reprocess AI).
- **Implementation**: Server component fetches, serializes to client `RecordingsGrid` component for interactive features.

## Enhanced Search (Phase 4.4)

Search page improvements:

- **Status filters**: Filter results by recording status (all, completed, processing, pending).
- **Result counts**: Total and per-category (semantic/keyword) result counts displayed after search.
- **Similarity scores**: Semantic results show a percentage match badge when similarity data is available.
- **Filter toggle panel**: Collapsible filter section with visual indicator when filters are active.

## Model Catalog

The Settings → Provedores tab supports a dynamic model catalog:

- **OpenRouter**: `GET /api/models?provider=openrouter` fetches 300+ models from the OpenRouter API, cached in Firestore `model_catalog` collection (6-hour TTL).
- **Other providers**: Static model definitions from `model-registry.ts`.
- **Quality ratings**: Each model has 4 scores (Extração/Síntese/Raciocínio/Redação, 0–100). For OpenRouter models, ratings are estimated from API `qualityScores` or pricing tier.
- **Personal catalog**: Users check models from the full catalog modal → stored as `selectedModels[]` in workspace settings.
- **Agent assignment**: Per-agent model selection modal shows only models from the personal catalog.
