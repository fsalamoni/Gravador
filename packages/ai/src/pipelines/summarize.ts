import type { Locale, TranscriptSegment } from '@gravador/core';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PROMPT_VERSION, getPrompts } from '../prompts/index.ts';
import { type ChatModelName, type ProviderKeys, resolveChatModel } from '../providers/index.ts';

const schema = z.object({
  tldr: z.string(),
  bullets: z.array(z.string()),
  longform: z.string(),
});

export async function runSummary(input: {
  segments: TranscriptSegment[];
  fullText: string;
  locale: Locale;
  model?: ChatModelName;
  provider?: 'anthropic' | 'openai' | 'google' | 'ollama';
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const { segments, fullText, locale, keys } = input;
  const provider = input.provider ?? 'anthropic';
  const model = input.model ?? (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4.1-mini');

  const system = getPrompts(locale).summary;
  const prompt = `TRANSCRIPT (${segments.length} segments, ${Math.round(fullText.length / 4)} tokens approx.):\n\n${fullText}`;

  const { object } = await generateObject({
    model: resolveChatModel(provider, model, keys),
    system,
    prompt,
    schema,
    temperature: 0.2,
  });

  return {
    payload: object,
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
