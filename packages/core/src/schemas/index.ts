import { z } from 'zod';

export const localeSchema = z.enum(['pt-BR', 'en']);

export const recordingStatusSchema = z.enum([
  'queued',
  'uploading',
  'transcribing',
  'diarizing',
  'summarizing',
  'embedding',
  'ready',
  'failed',
]);

export const aiOutputKindSchema = z.enum([
  'summary',
  'action_items',
  'mindmap',
  'chapters',
  'quotes',
  'sentiment',
  'flashcards',
]);

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  speakerId: z.string().nullable(),
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const mindMapNodeSchema: z.ZodType<{
  id: string;
  label: string;
  children: Array<{ id: string; label: string; children: unknown[]; segmentIds?: string[] }>;
  segmentIds?: string[];
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    children: z.array(mindMapNodeSchema),
    segmentIds: z.array(z.string()).optional(),
  }),
);

export const actionItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  assignee: z.string().nullable(),
  dueDate: z.string().nullable(),
  sourceSegmentIds: z.array(z.string()),
  done: z.boolean().default(false),
});

export const chapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  summary: z.string(),
});

export const quoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  speakerId: z.string().nullable(),
  segmentId: z.string(),
  reason: z.string(),
});

export const summaryPayloadSchema = z.object({
  tldr: z.string(),
  bullets: z.array(z.string()),
  longform: z.string(),
});

export const aiOutputPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('summary'), data: summaryPayloadSchema }),
  z.object({ kind: z.literal('action_items'), data: z.array(actionItemSchema) }),
  z.object({ kind: z.literal('mindmap'), data: mindMapNodeSchema }),
  z.object({ kind: z.literal('chapters'), data: z.array(chapterSchema) }),
  z.object({ kind: z.literal('quotes'), data: z.array(quoteSchema) }),
  z.object({
    kind: z.literal('sentiment'),
    data: z.object({ overall: z.number().min(-1).max(1), perChapter: z.record(z.number()) }),
  }),
  z.object({
    kind: z.literal('flashcards'),
    data: z.array(z.object({ q: z.string(), a: z.string() })),
  }),
]);

export const createRecordingInputSchema = z.object({
  title: z.string().max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).max(20).optional(),
  locale: localeSchema.optional(),
  durationMs: z.number().int().positive(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export type CreateRecordingInput = z.infer<typeof createRecordingInputSchema>;
export type AIOutputPayload = z.infer<typeof aiOutputPayloadSchema>;
export type SummaryPayload = z.infer<typeof summaryPayloadSchema>;
