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
  cards: z.array(
    z.object({
      q: z.string(),
      a: z.string(),
    }),
  ),
});

export async function runFlashcards(input: {
  fullText: string;
  locale: Locale;
  model?: ChatModelName;
  provider?: GenerationProvider;
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = (input.provider ?? 'anthropic') as GenerationProvider;
  const model = normalizeChatModel(provider, input.model);
  const system = getPrompts(input.locale).flashcards;
  const prompt = `TRANSCRIPT:\n\n${input.fullText}`;

  const object = await generateStructuredObject({
    model: resolveChatModel(provider, model, input.keys),
    system,
    prompt,
    schema,
    temperature: 0.3,
  });

  return {
    payload: object.cards,
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
