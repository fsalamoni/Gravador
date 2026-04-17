import type { Timestamp } from 'firebase-admin/firestore';

// ── Enums ──

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

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type Locale = 'pt-BR' | 'en';

export type Plan = 'free' | 'pro' | 'team' | 'selfhost';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type IntegrationProvider = 'google-drive' | 'dropbox' | 'onedrive' | 'notion' | 'obsidian';

// ── Document types ──

export type WorkspaceAISettings = {
  transcribeProvider?: 'groq' | 'openai' | 'local-faster-whisper';
  chatProvider?: 'anthropic' | 'openai' | 'google' | 'ollama';
  chatModel?: string;
  embeddingProvider?: 'openai' | 'ollama';
  embeddingModel?: string;
  byokKeys?: {
    openai?: string;
    anthropic?: string;
    groq?: string;
    google?: string;
  };
};

export interface UserDoc {
  email: string;
  fullName?: string;
  avatarUrl?: string;
  locale: Locale;
  createdAt: Timestamp;
}

export interface WorkspaceDoc {
  slug: string;
  name: string;
  ownerId: string;
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  aiSettings: WorkspaceAISettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkspaceMemberDoc {
  role: WorkspaceRole;
  joinedAt: Timestamp;
}

export interface FolderDoc {
  workspaceId: string;
  parentId?: string;
  name: string;
  color?: string;
  createdAt: Timestamp;
}

export interface TagDoc {
  workspaceId: string;
  name: string;
  color?: string;
}

export interface RecordingDoc {
  workspaceId: string;
  createdBy: string;
  folderId?: string;
  title?: string;
  status: RecordingStatus;
  locale?: Locale;
  durationMs: number;
  sizeBytes: number;
  mimeType: string;
  storagePath: string;
  storageBucket: string;
  waveformPeaks?: number[];
  capturedAt: Timestamp;
  capturedFromDevice?: string;
  latitude?: number;
  longitude?: number;
  deletedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TranscriptDoc {
  recordingId: string;
  provider: string;
  model: string;
  detectedLocale?: Locale;
  fullText: string;
  createdAt: Timestamp;
}

export interface TranscriptSegmentDoc {
  transcriptId: string;
  recordingId: string;
  speakerId?: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface AIOutputDoc {
  recordingId: string;
  kind: AIOutputKind;
  payload: unknown;
  provider: string;
  model: string;
  costCents: number;
  latencyMs?: number;
  promptVersion: string;
  locale?: Locale;
  createdAt: Timestamp;
}

export interface EmbeddingDoc {
  recordingId: string;
  workspaceId: string;
  chunkIndex: number;
  startSegmentId?: string;
  endSegmentId?: string;
  startMs: number;
  endMs: number;
  content: string;
  embedding: number[];
  model: string;
  createdAt: Timestamp;
}

export interface ActionItemDoc {
  recordingId: string;
  text: string;
  assignee?: string;
  dueDate?: Timestamp;
  done: boolean;
  sourceSegmentIds: string[];
  createdAt: Timestamp;
}

export interface ShareDoc {
  recordingId: string;
  workspaceId: string;
  createdBy: string;
  token: string;
  passwordHash?: string;
  expiresAt?: Timestamp | null;
  permissions: {
    viewTranscript: boolean;
    viewSummary: boolean;
    viewChat: boolean;
  };
  revokedAt?: Timestamp | null;
  createdAt: Timestamp;
}

export interface JobDoc {
  recordingId: string;
  workspaceId: string;
  kind: string;
  status: JobStatus;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface IntegrationDoc {
  workspaceId: string;
  userId: string;
  provider: IntegrationProvider;
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string;
  expiresAt?: Timestamp;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface UsageEventDoc {
  workspaceId: string;
  userId: string;
  kind: string;
  amount: number;
  recordingId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}
