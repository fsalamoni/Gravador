import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

export const recordingStatusEnum = pgEnum('recording_status', [
  'queued',
  'uploading',
  'transcribing',
  'diarizing',
  'summarizing',
  'embedding',
  'ready',
  'failed',
]);

export const aiOutputKindEnum = pgEnum('ai_output_kind', [
  'summary',
  'action_items',
  'mindmap',
  'chapters',
  'quotes',
  'sentiment',
  'flashcards',
]);

export const jobStatusEnum = pgEnum('job_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export const localeEnum = pgEnum('locale', ['pt-BR', 'en']);

export const planEnum = pgEnum('plan', ['free', 'pro', 'team', 'selfhost']);

/**
 * `users` mirrors a subset of `auth.users` (Supabase manages identity).
 * Populated via trigger after signup.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  locale: localeEnum('locale').default('pt-BR').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plan: planEnum('plan').default('free').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    aiSettings: jsonb('ai_settings').$type<WorkspaceAISettings>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('workspaces_slug_idx').on(t.slug),
  }),
);

export type WorkspaceAISettings = {
  transcribeProvider?: 'groq' | 'openai' | 'local-faster-whisper';
  chatProvider?: 'anthropic' | 'openai' | 'google' | 'ollama';
  chatModel?: string;
  embeddingProvider?: 'openai' | 'ollama';
  embeddingModel?: string;
  byokKeys?: {
    openai?: string;
    anthropic?: string;
    groq?: string;
    google?: string;
  };
};

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<'owner' | 'admin' | 'member'>().default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.userId] }) }),
);

export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
  },
  (t) => ({ unique: uniqueIndex('tags_workspace_name_idx').on(t.workspaceId, t.name) }),
);

export const recordings = pgTable(
  'recordings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    title: text('title'),
    status: recordingStatusEnum('status').default('queued').notNull(),
    locale: localeEnum('locale'),
    durationMs: integer('duration_ms').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    mimeType: text('mime_type').notNull(),
    storagePath: text('storage_path').notNull(),
    storageBucket: text('storage_bucket').default('audio-raw').notNull(),
    waveformPeaks: jsonb('waveform_peaks').$type<number[]>(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    capturedFromDevice: text('captured_from_device'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index('recordings_workspace_idx').on(t.workspaceId, t.capturedAt),
    folderIdx: index('recordings_folder_idx').on(t.folderId),
    statusIdx: index('recordings_status_idx').on(t.status),
  }),
);

export const recordingTags = pgTable(
  'recording_tags',
  {
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => recordings.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.recordingId, t.tagId] }) }),
);

export const speakers = pgTable('speakers', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  voiceEmbedding: vector('voice_embedding', { dimensions: 192 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transcripts = pgTable('transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .notNull()
    .references(() => recordings.id, { onDelete: 'cascade' })
    .unique(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  detectedLocale: localeEnum('detected_locale'),
  fullText: text('full_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transcriptSegments = pgTable(
  'transcript_segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transcriptId: uuid('transcript_id')
      .notNull()
      .references(() => transcripts.id, { onDelete: 'cascade' }),
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => recordings.id, { onDelete: 'cascade' }),
    speakerId: uuid('speaker_id').references(() => speakers.id),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    confidence: real('confidence'),
  },
  (t) => ({
    transcriptIdx: index('segments_transcript_idx').on(t.transcriptId, t.startMs),
    recordingIdx: index('segments_recording_idx').on(t.recordingId, t.startMs),
  }),
);

export const aiOutputs = pgTable(
  'ai_outputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => recordings.id, { onDelete: 'cascade' }),
    kind: aiOutputKindEnum('kind').notNull(),
    payload: jsonb('payload').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    costCents: integer('cost_cents').default(0).notNull(),
    latencyMs: integer('latency_ms'),
    promptVersion: text('prompt_version').notNull(),
    locale: localeEnum('locale'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqPerKind: uniqueIndex('ai_outputs_recording_kind_idx').on(t.recordingId, t.kind),
  }),
);

export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => recordings.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    startSegmentId: uuid('start_segment_id'),
    endSegmentId: uuid('end_segment_id'),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    model: text('model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    hnsw: index('embeddings_vector_idx')
      .using('hnsw', t.embedding.op('vector_cosine_ops'))
      .with({ m: 16, ef_construction: 64 }),
    workspaceIdx: index('embeddings_workspace_idx').on(t.workspaceId),
  }),
);

export const actionItems = pgTable('action_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .notNull()
    .references(() => recordings.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  assignee: text('assignee'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  done: boolean('done').default(false).notNull(),
  sourceSegmentIds: jsonb('source_segment_ids').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const shares = pgTable(
  'shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => recordings.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull(),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    permissions: jsonb('permissions')
      .$type<{ viewTranscript: boolean; viewSummary: boolean; viewChat: boolean }>()
      .default({ viewTranscript: true, viewSummary: true, viewChat: false })
      .notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ tokenIdx: uniqueIndex('shares_token_idx').on(t.token) }),
);

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider')
      .$type<'google-drive' | 'dropbox' | 'onedrive' | 'notion' | 'obsidian'>()
      .notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('integrations_user_provider_idx').on(t.userId, t.provider, t.workspaceId),
  }),
);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordingId: uuid('recording_id').references(() => recordings.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    status: jobStatusEnum('status').default('queued').notNull(),
    attempt: integer('attempt').default(0).notNull(),
    triggerRunId: text('trigger_run_id'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('jobs_status_idx').on(t.status),
    recordingIdx: index('jobs_recording_idx').on(t.recordingId),
  }),
);

export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  units: real('units').notNull(),
  costCents: integer('cost_cents').default(0).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ftsView = sql`-- materialized search handled via migration`;

export type Recording = typeof recordings.$inferSelect;
export type NewRecording = typeof recordings.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type TranscriptSegmentRow = typeof transcriptSegments.$inferSelect;
export type AIOutputRow = typeof aiOutputs.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Share = typeof shares.$inferSelect;
