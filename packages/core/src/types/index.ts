export type Locale = 'pt-BR' | 'en';

export type DeploymentMode = 'cloud' | 'selfhost';

export type AIProvider = 'openai' | 'anthropic' | 'groq' | 'google' | 'ollama' | 'openrouter';

export type TranscribeProvider = 'groq' | 'openai' | 'local-faster-whisper';

export type TranscribeModel = string;

export type EmbeddingProvider = 'openai' | 'ollama';

export type RecordingStatus =
  | 'queued'
  | 'uploading'
  | 'transcribing'
  | 'diarizing'
  | 'summarizing'
  | 'embedding'
  | 'ready'
  | 'failed';

export type AIOutputKind =
  | 'summary'
  | 'action_items'
  | 'mindmap'
  | 'chapters'
  | 'quotes'
  | 'sentiment'
  | 'flashcards';

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  speakerId: string | null;
  text: string;
  confidence: number | null;
}

export interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
  segmentIds?: string[];
}

export interface ActionItem {
  id: string;
  text: string;
  assignee: string | null;
  dueDate: string | null;
  sourceSegmentIds: string[];
  done: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  summary: string;
}

export interface Quote {
  id: string;
  text: string;
  speakerId: string | null;
  segmentId: string;
  reason: string;
}
