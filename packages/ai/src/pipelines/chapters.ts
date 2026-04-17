import type { Locale, TranscriptSegment } from '@gravador/core';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PROMPT_VERSION, getPrompts } from '../prompts/index.ts';
import { type ChatModelName, type ProviderKeys, resolveChatModel } from '../providers/index.ts';

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
  provider?: 'anthropic' | 'openai' | 'google' | 'ollama';
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = input.provider ?? 'anthropic';
  const model = input.model ?? (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4.1-mini');

  const prompt = input.segments.map((s) => `[${s.startMs}ms-${s.endMs}ms] ${s.text}`).join('\n');

  const { object } = await generateObject({
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
