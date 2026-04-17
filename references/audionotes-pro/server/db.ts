import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  actionItems,
  aiMessages,
  mindMaps,
  recordings,
  summaries,
  transcriptions,
  users,
  type InsertActionItem,
  type InsertAiMessage,
  type InsertMindMap,
  type InsertRecording,
  type InsertSummary,
  type InsertTranscription,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Recording Functions ============

export async function createRecording(data: InsertRecording) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recordings).values(data);
  return (result[0] as any).insertId as number;
}

export async function getUserRecordings(userId: number, filter?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(recordings.userId, userId)];
  if (filter === "starred") conditions.push(eq(recordings.isStarred, true));
  else if (filter === "meeting") conditions.push(eq(recordings.recordingMode, "meeting"));
  else if (filter === "call") conditions.push(eq(recordings.recordingMode, "call"));
  else if (filter === "voice_memo") conditions.push(eq(recordings.recordingMode, "voice_memo"));
  return db.select().from(recordings).where(and(...conditions)).orderBy(desc(recordings.createdAt));
}

export async function getRecordingById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(recordings).where(and(eq(recordings.id, id), eq(recordings.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateRecording(id: number, data: Partial<InsertRecording>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recordings).set(data).where(eq(recordings.id, id));
}

export async function deleteRecording(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(transcriptions).where(eq(transcriptions.recordingId, id));
  await db.delete(summaries).where(eq(summaries.recordingId, id));
  await db.delete(mindMaps).where(eq(mindMaps.recordingId, id));
  await db.delete(actionItems).where(eq(actionItems.recordingId, id));
  await db.delete(aiMessages).where(eq(aiMessages.recordingId, id));
  await db.delete(recordings).where(eq(recordings.id, id));
}

export async function searchRecordings(userId: number, query: string) {
  const db = await getDb();
  if (!db) return [];
  const searchTerm = `%${query}%`;
  return db.select().from(recordings).where(and(eq(recordings.userId, userId), or(like(recordings.title, searchTerm), like(recordings.description, searchTerm)))).orderBy(desc(recordings.createdAt)).limit(20);
}

// ============ Transcription Functions ============

export async function createTranscription(data: InsertTranscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transcriptions).values(data);
  return (result[0] as any).insertId as number;
}

export async function getTranscriptionByRecordingId(recordingId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(transcriptions).where(eq(transcriptions.recordingId, recordingId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateTranscription(id: number, data: Partial<InsertTranscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(transcriptions).set(data).where(eq(transcriptions.id, id));
}

// ============ Summary Functions ============

export async function createSummary(data: InsertSummary) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(summaries).values(data);
  return (result[0] as any).insertId as number;
}

export async function getSummariesByRecordingId(recordingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(summaries).where(eq(summaries.recordingId, recordingId));
}

export async function getSummaryByTemplate(recordingId: number, templateType: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(summaries).where(and(eq(summaries.recordingId, recordingId), eq(summaries.templateType, templateType as any))).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateSummary(id: number, data: Partial<InsertSummary>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(summaries).set(data).where(eq(summaries.id, id));
}

// ============ Mind Map Functions ============

export async function createMindMap(data: InsertMindMap) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mindMaps).values(data);
  return (result[0] as any).insertId as number;
}

export async function getMindMapByRecordingId(recordingId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(mindMaps).where(eq(mindMaps.recordingId, recordingId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateMindMap(id: number, data: Partial<InsertMindMap>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mindMaps).set(data).where(eq(mindMaps.id, id));
}

// ============ Action Items Functions ============

export async function createActionItems(items: InsertActionItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(actionItems).values(items);
}

export async function getActionItemsByRecordingId(recordingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionItems).where(eq(actionItems.recordingId, recordingId));
}

export async function updateActionItem(id: number, data: Partial<InsertActionItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(actionItems).set(data).where(eq(actionItems.id, id));
}

// ============ AI Messages Functions ============

export async function createAiMessage(data: InsertAiMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiMessages).values(data);
  return (result[0] as any).insertId as number;
}

export async function getAiMessagesByRecordingId(recordingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiMessages).where(eq(aiMessages.recordingId, recordingId)).orderBy(aiMessages.createdAt);
}
