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
  chapters: z.array(
    z.object({
      title: z.string(),
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().nonnegative(),
      summary: z.string(),
    }),
  ),
});

export async function runChapters(input: {
  segments: TranscriptSegment[];
  locale: Locale;
  model?: ChatModelName;
  provider?: GenerationProvider;
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = (input.provider ?? 'anthropic') as GenerationProvider;
  const model = normalizeChatModel(provider, input.model);

  const prompt = input.segments.map((s) => `[${s.startMs}ms-${s.endMs}ms] ${s.text}`).join('\n');

  const object = await generateStructuredObject({
    model: resolveChatModel(provider, model, input.keys),
    system: getPrompts(input.locale).chapters,
    prompt,
    schema,
    temperature: 0.2,
  });

  return {
    payload: object.chapters,
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
