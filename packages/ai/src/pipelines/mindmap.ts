import type { Locale } from '@gravador/core';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PROMPT_VERSION, getPrompts } from '../prompts/index.ts';
import { type ChatModelName, type ProviderKeys, resolveChatModel } from '../providers/index.ts';

type Node = { id: string; label: string; children: Node[]; segmentIds?: string[] };

const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string().max(80),
    children: z.array(nodeSchema),
    segmentIds: z.array(z.string()).optional(),
  }),
);

export async function runMindmap(input: {
  fullText: string;
  locale: Locale;
  model?: ChatModelName;
  provider?: 'anthropic' | 'openai' | 'google' | 'ollama';
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = input.provider ?? 'anthropic';
  const model = input.model ?? (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4.1');

  const { object } = await generateObject({
    model: resolveChatModel(provider, model, input.keys),
    system: getPrompts(input.locale).mindmap,
    prompt: input.fullText,
    schema: nodeSchema,
    temperature: 0.3,
  });

  return {
    payload: object,
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
