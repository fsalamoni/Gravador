import type { Locale, TranscriptSegment } from '@gravador/core';
import {
  type ChatModelCandidate,
  type ChatModelName,
  type GenerationProvider,
  type ProviderKeys,
  buildChatModelCandidates,
  isRecoverableModelRoutingError,
} from '../providers/index.ts';
import { runActionItems } from './action-items.ts';
import { runChapters } from './chapters.ts';
import { runFlashcards } from './flashcards.ts';
import { runMindmap } from './mindmap.ts';
import { runQuotes } from './quotes.ts';
import { runSentiment } from './sentiment.ts';
import { runSummary } from './summarize.ts';

export type AgentTaskKind =
  | 'summary'
  | 'actionItems'
  | 'mindmap'
  | 'chapters'
  | 'quotes'
  | 'sentiment'
  | 'flashcards';

export interface AgentFallbackInput {
  task: AgentTaskKind;
  preferredProvider?: GenerationProvider;
  preferredModel?: string;
  keys?: ProviderKeys;
  locale: Locale;
  fullText: string;
  segments: TranscriptSegment[];
}

export interface AgentTaskResult {
  payload: unknown;
  provider: GenerationProvider;
  model: ChatModelName;
  promptVersion: string;
  latencyMs: number;
}

function isTaskSatisfiedByRecovery(task: AgentTaskKind, error: unknown): boolean {
  if (!isRecoverableModelRoutingError(error)) return false;
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();

  // If provider says structured output/tool-use isn't supported, a different model/provider can fix it.
  if (message.includes('tool use') || message.includes('json') || message.includes('structured')) {
    return true;
  }

  // Missing key/model/access are recoverable by trying another configured provider/model.
  return true;
}

async function executeTask(
  task: AgentTaskKind,
  candidate: ChatModelCandidate,
  input: AgentFallbackInput,
): Promise<AgentTaskResult> {
  const common = {
    locale: input.locale,
    provider: candidate.provider,
    model: candidate.model as ChatModelName,
    keys: input.keys,
  };

  switch (task) {
    case 'summary':
      return runSummary({
        ...common,
        fullText: input.fullText,
        segments: input.segments,
      });
    case 'actionItems':
      return runActionItems({
        ...common,
        segments: input.segments,
      });
    case 'mindmap':
      return runMindmap({
        ...common,
        fullText: input.fullText,
      });
    case 'chapters':
      return runChapters({
        ...common,
        segments: input.segments,
      });
    case 'quotes':
      return runQuotes({
        ...common,
        segments: input.segments,
      });
    case 'sentiment':
      return runSentiment({
        ...common,
        fullText: input.fullText,
      });
    case 'flashcards':
      return runFlashcards({
        ...common,
        fullText: input.fullText,
      });
  }
}

export async function runAgentTaskWithFallback(input: AgentFallbackInput) {
  const candidates = buildChatModelCandidates(
    {
      provider: input.preferredProvider,
      model: input.preferredModel,
    },
    input.keys,
  );

  if (candidates.length === 0) {
    throw new Error(
      'No AI provider keys configured for chat tasks. Configure at least one provider key.',
    );
  }

  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return await executeTask(input.task, candidate, input);
    } catch (error) {
      if (!isTaskSatisfiedByRecovery(input.task, error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      errors.push(`${candidate.provider}/${candidate.model}: ${message}`);
    }
  }

  throw new Error(`All model fallbacks failed for ${input.task}. Attempts: ${errors.join(' | ')}`);
}
