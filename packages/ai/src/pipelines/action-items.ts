import type { Locale, TranscriptSegment } from '@gravador/core';
import { z } from 'zod';
import { PROMPT_VERSION, getPrompts } from '../prompts/index.ts';
import {
  type ChatModelName,
  type GenerationProvider,
  type ProviderKeys,
  normalizeChatModel,
  resolveChatModel,
} from '../providers/index.ts';
import { generateStructuredObject } from './structured-output.ts';

const schema = z.object({
  items: z.array(
    z.object({
      text: z.string(),
      assignee: z.string().nullable(),
      dueDate: z.string().nullable(),
      sourceSegmentIds: z.array(z.string()).default([]),
    }),
  ),
});

export async function runActionItems(input: {
  segments: TranscriptSegment[];
  locale: Locale;
  model?: ChatModelName;
  provider?: GenerationProvider;
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = (input.provider ?? 'anthropic') as GenerationProvider;
  const model = normalizeChatModel(provider, input.model);
  const system = getPrompts(input.locale).actionItems;
  const prompt = input.segments.map((s) => `[${s.id}] ${s.text}`).join('\n');

  const object = await generateStructuredObject({
    model: resolveChatModel(provider, model, input.keys),
    system,
    prompt,
    schema,
    temperature: 0.1,
  });

  return {
    payload: object.items,
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
