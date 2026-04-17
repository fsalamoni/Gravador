import type { Locale } from '@gravador/core';
import { type CoreMessage, streamText } from 'ai';
import { getPrompts } from '../prompts/index.ts';
import { type ChatModelName, type ProviderKeys, resolveChatModel } from '../providers/index.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RetrievedChunk {
  content: string;
  startMs: number;
  endMs: number;
  similarity: number;
}

/**
 * Stream a chat response grounded in retrieved transcript chunks (RAG).
 * Returns the AI SDK result; wire to `result.toDataStreamResponse()` in Next.js.
 */
export function chatWithRecording(input: {
  messages: ChatMessage[];
  context: RetrievedChunk[];
  locale: Locale;
  model?: ChatModelName;
  provider?: 'anthropic' | 'openai' | 'google' | 'ollama';
  keys?: ProviderKeys;
}) {
  const provider = input.provider ?? 'anthropic';
  const model = input.model ?? (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4.1-mini');

  const contextBlock = input.context
    .map(
      (c, i) =>
        `[source ${i + 1} · ${formatMs(c.startMs)}-${formatMs(c.endMs)} · sim=${c.similarity.toFixed(
          2,
        )}]\n${c.content}`,
    )
    .join('\n\n');

  const messages: CoreMessage[] = [
    {
      role: 'system',
      content: `${getPrompts(input.locale).chatSystem}\n\n--- CONTEXT ---\n${contextBlock || '(no context retrieved)'}`,
    },
    ...input.messages.map<CoreMessage>((m) => ({ role: m.role, content: m.content })),
  ];

  return streamText({
    model: resolveChatModel(provider, model, input.keys),
    messages,
    temperature: 0.3,
  });
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
