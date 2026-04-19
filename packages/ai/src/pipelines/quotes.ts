import type { Locale, TranscriptSegment } from '@gravador/core';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PROMPT_VERSION, getPrompts } from '../prompts/index.ts';
import { type ChatModelName, type ProviderKeys, resolveChatModel } from '../providers/index.ts';

const schema = z.object({
  quotes: z.array(
    z.object({
      text: z.string(),
      segmentId: z.string(),
      speakerId: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});

export async function runQuotes(input: {
  segments: TranscriptSegment[];
  locale: Locale;
  model?: ChatModelName;
  provider?: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter';
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = input.provider ?? 'anthropic';
  const model = input.model ?? (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4.1-mini');
  const system = getPrompts(input.locale).quotes;
  const prompt = input.segments.map((s) => `[${s.id}] ${s.speakerId ?? '?'}: ${s.text}`).join('\n');

  const { object } = await generateObject({
    model: resolveChatModel(provider, model, input.keys),
    system,
    prompt,
    schema,
    temperature: 0.2,
  });

  return {
    payload: object.quotes,
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
