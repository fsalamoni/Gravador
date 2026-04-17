import {
  boolean,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // Google Drive integration
  googleDriveEnabled: boolean("googleDriveEnabled").default(false),
  googleDriveFolderId: varchar("googleDriveFolderId", { length: 255 }),
  googleDriveFolderName: varchar("googleDriveFolderName", { length: 255 }),
  googleAccessToken: text("googleAccessToken"),
  googleRefreshToken: text("googleRefreshToken"),
  googleTokenExpiry: timestamp("googleTokenExpiry"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============ AudioNotes Pro Tables ============

/**
 * Recordings table — stores audio recording metadata
 */
export const recordings = mysqlTable("recordings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).default("Untitled Recording").notNull(),
  description: text("description"),
  audioUrl: text("audioUrl"),
  audioKey: text("audioKey"),
  duration: int("duration").default(0).notNull(),
  fileSize: int("fileSize").default(0),
  mimeType: varchar("mimeType", { length: 50 }).default("audio/m4a"),
  language: varchar("language", { length: 10 }).default("auto"),
  recordingMode: mysqlEnum("recordingMode", ["ambient", "meeting", "call", "voice_memo"])
    .default("ambient")
    .notNull(),
  status: mysqlEnum("status", ["recording", "saved", "uploading", "uploaded", "error"])
    .default("saved")
    .notNull(),
  isStarred: boolean("isStarred").default(false).notNull(),
  isSynced: boolean("isSynced").default(false).notNull(),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;

/**
 * Transcriptions table — stores Whisper transcription results
 */
export const transcriptions = mysqlTable("transcriptions", {
  id: int("id").autoincrement().primaryKey(),
  recordingId: int("recordingId").notNull(),
  fullText: text("fullText"),
  language: varchar("language", { length: 10 }),
  confidence: float("confidence"),
  segments: json("segments").$type<TranscriptSegment[]>(),
  speakerLabels: json("speakerLabels").$type<SpeakerLabel[]>(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"])
    .default("pending")
    .notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transcription = typeof transcriptions.$inferSelect;
export type InsertTranscription = typeof transcriptions.$inferInsert;

/**
 * Summaries table — stores AI-generated summaries
 */
export const summaries = mysqlTable("summaries", {
  id: int("id").autoincrement().primaryKey(),
  recordingId: int("recordingId").notNull(),
  templateType: mysqlEnum("templateType", [
    "executive",
    "action_items",
    "decisions",
    "feedback",
    "strategic",
    "meeting_notes",
    "custom",
  ])
    .default("executive")
    .notNull(),
  content: text("content"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"])
    .default("pending")
    .notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = typeof summaries.$inferInsert;

/**
 * Mind maps table — stores AI-generated mind map data
 */
export const mindMaps = mysqlTable("mindMaps", {
  id: int("id").autoincrement().primaryKey(),
  recordingId: int("recordingId").notNull(),
  data: json("data").$type<MindMapNode>(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"])
    .default("pending")
    .notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MindMap = typeof mindMaps.$inferSelect;
export type InsertMindMap = typeof mindMaps.$inferInsert;

/**
 * Action items table — stores AI-extracted action items
 */
export const actionItems = mysqlTable("actionItems", {
  id: int("id").autoincrement().primaryKey(),
  recordingId: int("recordingId").notNull(),
  text: text("text").notNull(),
  assignee: varchar("assignee", { length: 255 }),
  dueDate: varchar("dueDate", { length: 50 }),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium").notNull(),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  sourceTimestamp: int("sourceTimestamp"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = typeof actionItems.$inferInsert;

/**
 * AI Chat messages table — stores Ask AI conversations
 */
export const aiMessages = mysqlTable("aiMessages", {
  id: int("id").autoincrement().primaryKey(),
  recordingId: int("recordingId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  citations: json("citations").$type<Citation[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = typeof aiMessages.$inferInsert;

// ============ Shared Types ============

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface SpeakerLabel {
  id: string;
  name: string;
  color: string;
}

export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
  color?: string;
  level?: number;
}

export interface Citation {
  text: string;
  timestamp: number;
  segmentId?: number;
}
