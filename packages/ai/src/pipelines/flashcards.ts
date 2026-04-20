import type { Locale } from '@gravador/core';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PROMPT_VERSION, getPrompts } from '../prompts/index.ts';
import { type ChatModelName, type ProviderKeys, resolveChatModel } from '../providers/index.ts';

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
  provider?: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter';
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = input.provider ?? 'anthropic';
  const model = input.model ?? (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4.1-mini');
  const system = getPrompts(input.locale).flashcards;
  const prompt = `TRANSCRIPT:\n\n${input.fullText}`;

  const { object } = await generateObject({
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
