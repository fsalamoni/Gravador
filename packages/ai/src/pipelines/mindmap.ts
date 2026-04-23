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
  provider?: GenerationProvider;
  keys?: ProviderKeys;
}) {
  const started = Date.now();
  const provider = (input.provider ?? 'anthropic') as GenerationProvider;
  const model = normalizeChatModel(provider, input.model);

  const object = await generateStructuredObject({
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
