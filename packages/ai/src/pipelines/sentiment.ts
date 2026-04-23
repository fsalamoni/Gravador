import type { Locale } from '@gravador/core';
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
  overall: z.number().min(-1).max(1),
  perChapter: z.record(z.string(), z.number().min(-1).max(1)),
});

export async function runSentiment(input: {
  fullText: string;
  chapters?: Array<{ title: string; startMs: number; endMs: number }>;
  locale: Locale;
  model?: ChatModelName;
  provider?: GenerationProvider;
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = (input.provider ?? 'anthropic') as GenerationProvider;
  const model = normalizeChatModel(provider, input.model);
  const system = getPrompts(input.locale).sentiment;

  let prompt = `TRANSCRIPT:\n\n${input.fullText}`;
  if (input.chapters?.length) {
    prompt += `\n\nCHAPTERS:\n${input.chapters.map((c, i) => `${i}: ${c.title} (${c.startMs}ms – ${c.endMs}ms)`).join('\n')}`;
  }

  const object = await generateStructuredObject({
    model: resolveChatModel(provider, model, input.keys),
    system,
    prompt,
    schema,
    temperature: 0.1,
  });

  return {
    payload: object,
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
