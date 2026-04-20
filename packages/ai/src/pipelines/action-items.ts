import type { Locale, TranscriptSegment } from '@gravador/core';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PROMPT_VERSION, getPrompts } from '../prompts/index.ts';
import { type ChatModelName, type ProviderKeys, resolveChatModel } from '../providers/index.ts';

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
  provider?: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter';
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = input.provider ?? 'anthropic';
  const model = input.model ?? (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4.1-mini');
  const system = getPrompts(input.locale).actionItems;
  const prompt = input.segments.map((s) => `[${s.id}] ${s.text}`).join('\n');

  const { object } = await generateObject({
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
