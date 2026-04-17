/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ============ App-specific shared types ============

export type RecordingMode = "ambient" | "meeting" | "call" | "voice_memo";
export type RecordingStatus = "recording" | "saved" | "uploading" | "uploaded" | "error";
export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";
export type SummaryTemplate =
  | "executive"
  | "action_items"
  | "decisions"
  | "feedback"
  | "strategic"
  | "meeting_notes"
  | "custom";

export interface UploadAudioInput {
  recordingId: number;
  audioBase64: string;
  mimeType: string;
  fileName: string;
}

export interface TranscribeInput {
  recordingId: number;
  language?: string;
}

export interface GenerateSummaryInput {
  recordingId: number;
  templateType: SummaryTemplate;
}

export interface GenerateMindMapInput {
  recordingId: number;
}

export interface AskAIInput {
  recordingId: number;
  question: string;
}
