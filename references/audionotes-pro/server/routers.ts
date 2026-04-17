import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import * as db from "./db";
import { storagePut } from "./storage";
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getOrCreateAudioNotesFolder,
  getValidAccessToken,
  uploadToDrive,
  listDriveFiles,
} from "./google-drive";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";

const recordingsRouter = router({
  list: protectedProcedure
    .input(z.object({ filter: z.string().optional() }))
    .query(({ ctx, input }) => db.getUserRecordings(ctx.user.id, input.filter)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.id, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND", message: "Recording not found" });
      return recording;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().optional(),
      duration: z.number().default(0),
      recordingMode: z.enum(["ambient", "meeting", "call", "voice_memo"]).default("ambient"),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await db.createRecording({
        userId: ctx.user.id,
        title: input.title || "Untitled Recording",
        duration: input.duration,
        recordingMode: input.recordingMode,
        language: input.language || "auto",
        status: "saved",
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      isStarred: z.boolean().optional(),
      recordingMode: z.enum(["ambient", "meeting", "call", "voice_memo"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.id, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      const { id, ...data } = input;
      await db.updateRecording(id, data as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.id, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      await db.deleteRecording(input.id);
      return { success: true };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(({ ctx, input }) => db.searchRecordings(ctx.user.id, input.query)),

  uploadAudio: protectedProcedure
    .input(z.object({
      recordingId: z.number(),
      audioBase64: z.string(),
      mimeType: z.string().default("audio/m4a"),
      fileName: z.string(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const fileKey = `recordings/${ctx.user.id}/${input.recordingId}/${input.fileName}`;
      const { url } = await storagePut(fileKey, audioBuffer, input.mimeType);
      await db.updateRecording(input.recordingId, {
        audioUrl: url, audioKey: fileKey, fileSize: audioBuffer.length,
        mimeType: input.mimeType, status: "uploaded", isSynced: true,
        ...(input.duration ? { duration: input.duration } : {}),
      });
      return { url, fileKey };
    }),
});

const transcriptionRouter = router({
  get: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getTranscriptionByRecordingId(input.recordingId);
    }),

  start: protectedProcedure
    .input(z.object({ recordingId: z.number(), language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      if (!recording.audioUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Audio not uploaded yet" });

      let transcription = await db.getTranscriptionByRecordingId(input.recordingId);
      if (!transcription) {
        await db.createTranscription({ recordingId: input.recordingId, status: "processing" });
        transcription = await db.getTranscriptionByRecordingId(input.recordingId);
      } else {
        await db.updateTranscription(transcription.id, { status: "processing" });
      }

      const transcriptionId = transcription!.id;
      (async () => {
        try {
          const rawResult = await transcribeAudio({
            audioUrl: recording.audioUrl!,
            language: input.language || recording.language || undefined,
          });
          const result = rawResult as any;
          await db.updateTranscription(transcriptionId, {
            fullText: result.text || null,
            language: result.language || null,
            segments: result.segments?.map((s: any, i: number) => ({
              id: i, start: s.start, end: s.end, text: s.text,
              confidence: s.avg_logprob ? Math.exp(s.avg_logprob) : undefined,
            })) || [],
            status: "completed",
          });
          if (recording.title === "Untitled Recording" && result.text) {
            const titleRes = await invokeLLM({
              messages: [
                { role: "system", content: "Generate a concise title (max 6 words) for this recording. Return only the title." },
                { role: "user", content: String(result.text).substring(0, 500) },
              ],
            });
            const title = String(titleRes.choices[0]?.message?.content || "").trim();
            if (title) await db.updateRecording(input.recordingId, { title });
          }
          // Notify owner that transcription is complete
          await notifyOwner({
            title: "Transcrição Concluída",
            content: `A transcrição de "${recording.title}" foi concluída com sucesso.`,
          }).catch(() => {}); // Non-critical
        } catch (error) {
          await db.updateTranscription(transcriptionId, { status: "failed", errorMessage: String(error) });
        }
      })();

      return { transcriptionId, status: "processing" };
    }),
});

const summaryRouter = router({
  list: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getSummariesByRecordingId(input.recordingId);
    }),

  generate: protectedProcedure
    .input(z.object({
      recordingId: z.number(),
      templateType: z.enum(["executive", "action_items", "decisions", "feedback", "strategic", "meeting_notes", "custom"]).default("executive"),
    }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      const transcription = await db.getTranscriptionByRecordingId(input.recordingId);
      if (!transcription?.fullText) throw new TRPCError({ code: "BAD_REQUEST", message: "Transcription not available" });

      let summary = await db.getSummaryByTemplate(input.recordingId, input.templateType);
      if (!summary) {
        await db.createSummary({ recordingId: input.recordingId, templateType: input.templateType, status: "processing" });
        summary = await db.getSummaryByTemplate(input.recordingId, input.templateType);
      } else {
        await db.updateSummary(summary.id, { status: "processing" });
      }

      const summaryId = summary!.id;
      const prompts: Record<string, string> = {
        executive: "Create an executive summary with: Key Points (3-5 bullets), Main Decisions, Next Steps.",
        action_items: "Extract all action items. For each: task, assignee, deadline, priority. Format as numbered list.",
        decisions: "List all decisions made. For each: decision, rationale, who decided.",
        feedback: "Summarize feedback: positive points, areas for improvement, specific suggestions.",
        strategic: "Strategic analysis: key themes, implications, opportunities, risks.",
        meeting_notes: "Professional meeting notes: attendees, agenda, discussions, decisions, action items.",
        custom: "Comprehensive summary with key points, important details, and action items.",
      };

      (async () => {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: prompts[input.templateType] },
              { role: "user", content: `Transcript:\n\n${transcription.fullText}` },
            ],
          });
          const content = String(response.choices[0]?.message?.content || "");
          await db.updateSummary(summaryId, { content, status: "completed" });
          // Notify owner that summary is complete
          await notifyOwner({
            title: "Resumo Gerado",
            content: `O resumo de "${recording.title}" (${input.templateType}) está pronto.`,
          }).catch(() => {}); // Non-critical
        } catch (error) {
          await db.updateSummary(summaryId, { status: "failed", errorMessage: String(error) });
        }
      })();

      return { summaryId, status: "processing" };
    }),
});

const mindMapRouter = router({
  get: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getMindMapByRecordingId(input.recordingId);
    }),

  generate: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      const transcription = await db.getTranscriptionByRecordingId(input.recordingId);
      if (!transcription?.fullText) throw new TRPCError({ code: "BAD_REQUEST", message: "Transcription not available" });

      let mindMap = await db.getMindMapByRecordingId(input.recordingId);
      if (!mindMap) {
        await db.createMindMap({ recordingId: input.recordingId, status: "processing" });
        mindMap = await db.getMindMapByRecordingId(input.recordingId);
      } else {
        await db.updateMindMap(mindMap.id, { status: "processing" });
      }

      const mindMapId = mindMap!.id;
      (async () => {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: `Create a hierarchical mind map. Return JSON: {"id":"root","text":"Main Topic","color":"#6366F1","level":0,"children":[{"id":"n1","text":"Branch","color":"#8B5CF6","level":1,"children":[{"id":"n1_1","text":"Detail","color":"#A78BFA","level":2,"children":[]}]}]}. Use 3-4 main branches, 2-4 sub-items each. Max 5 words per node.` },
              { role: "user", content: (transcription.fullText || "").substring(0, 3000) },
            ],
            response_format: { type: "json_object" },
          });
          const data = JSON.parse(String(response.choices[0]?.message?.content || "{}") || "{}");
          await db.updateMindMap(mindMapId, { data, status: "completed" });
        } catch (error) {
          await db.updateMindMap(mindMapId, { status: "failed", errorMessage: String(error) });
        }
      })();

      return { mindMapId, status: "processing" };
    }),
});

const actionItemsRouter = router({
  list: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getActionItemsByRecordingId(input.recordingId);
    }),

  generate: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      const transcription = await db.getTranscriptionByRecordingId(input.recordingId);
      if (!transcription?.fullText) throw new TRPCError({ code: "BAD_REQUEST", message: "Transcription not available" });

      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Extract action items. Return JSON: {"items":[{"text":"task","assignee":"name or null","dueDate":"date or null","priority":"high|medium|low","sourceTimestamp":null}]}` },
          { role: "user", content: transcription.fullText },
        ],
        response_format: { type: "json_object" },
      });

      try {
        const rawContent = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : "{}");
        const items = parsed.items || [];
        if (items.length > 0) {
          await db.createActionItems(items.map((item: any) => ({
            recordingId: input.recordingId,
            text: item.text || "",
            assignee: item.assignee || null,
            dueDate: item.dueDate || null,
            priority: item.priority || "medium",
            sourceTimestamp: item.sourceTimestamp || null,
          })));
        }
        return { count: items.length };
      } catch { return { count: 0 }; }
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      isCompleted: z.boolean().optional(),
      text: z.string().optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateActionItem(id, data as any);
      return { success: true };
    }),
});

const askAIRouter = router({
  messages: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getAiMessagesByRecordingId(input.recordingId);
    }),

  ask: protectedProcedure
    .input(z.object({ recordingId: z.number(), question: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });
      const transcription = await db.getTranscriptionByRecordingId(input.recordingId);
      if (!transcription?.fullText) throw new TRPCError({ code: "BAD_REQUEST", message: "Transcription not available" });

      await db.createAiMessage({ recordingId: input.recordingId, role: "user", content: input.question });

      const previousMessages = await db.getAiMessagesByRecordingId(input.recordingId);
      const contextMessages = previousMessages.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are an AI assistant analyzing a recording. Answer based ONLY on the transcript.\n\nTranscript:\n${transcription.fullText}` },
          ...contextMessages,
        ],
      });

      const answer = String(response.choices[0]?.message?.content || "I could not generate an answer.");
      const messageId = await db.createAiMessage({ recordingId: input.recordingId, role: "assistant", content: answer });
      return { answer, messageId };
    }),
});


const googleDriveRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return { connected: false, folderName: null, folderId: null, hasCredentials: false };
    const [user] = await dbInstance.select({
      googleDriveEnabled: users.googleDriveEnabled,
      googleDriveFolderName: users.googleDriveFolderName,
      googleDriveFolderId: users.googleDriveFolderId,
    }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return {
      connected: user?.googleDriveEnabled ?? false,
      folderName: user?.googleDriveFolderName ?? null,
      folderId: user?.googleDriveFolderId ?? null,
      hasCredentials: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    };
  }),

  getAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string() }))
    .mutation(({ ctx, input }) => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables." });
      const state = Buffer.from(JSON.stringify({ userId: ctx.user.id, ts: Date.now() })).toString("base64");
      const url = getGoogleAuthUrl(clientId, input.redirectUri, state);
      return { url, state };
    }),

  connect: protectedProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string(), folderName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not configured on server." });
      const { accessToken, refreshToken, expiresIn } = await exchangeGoogleCode(input.code, clientId, clientSecret, input.redirectUri);
      const folder = await getOrCreateAudioNotesFolder(accessToken, input.folderName || "AudioNotes Pro");
      const expiry = new Date(Date.now() + expiresIn * 1000);
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await dbInstance.update(users).set({
        googleDriveEnabled: true,
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
        googleTokenExpiry: expiry,
        googleDriveFolderId: folder.id,
        googleDriveFolderName: folder.name,
      }).where(eq(users.id, ctx.user.id));
      return { success: true, folderId: folder.id, folderName: folder.name };
    }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await dbInstance.update(users).set({
      googleDriveEnabled: false,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      googleDriveFolderId: null,
      googleDriveFolderName: null,
    }).where(eq(users.id, ctx.user.id));
    return { success: true };
  }),

  syncRecording: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const recording = await db.getRecordingById(input.recordingId, ctx.user.id);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND", message: "Recording not found" });
      if (!recording.audioUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Recording has no audio file to sync" });
      const accessToken = await getValidAccessToken(ctx.user.id);
      if (!accessToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Google Drive not connected or token expired" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [user] = await dbInstance.select({ googleDriveFolderId: users.googleDriveFolderId }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user?.googleDriveFolderId) throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive folder not configured" });
      const audioRes = await fetch(recording.audioUrl);
      if (!audioRes.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch audio from storage" });
      const audioBuffer = await audioRes.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");
      const fileName = `${recording.title || "recording"}_${recording.id}.m4a`;
      const driveFile = await uploadToDrive(accessToken, user.googleDriveFolderId, fileName, audioBase64, recording.mimeType || "audio/m4a");
      return { success: true, driveFileId: driveFile.id, driveUrl: driveFile.webViewLink };
    }),

  listFiles: protectedProcedure.query(async ({ ctx }) => {
    const accessToken = await getValidAccessToken(ctx.user.id);
    if (!accessToken) return { files: [], error: "not_connected" };
    const dbInstance = await db.getDb();
    if (!dbInstance) return { files: [], error: "db_unavailable" };
    const [user] = await dbInstance.select({ googleDriveFolderId: users.googleDriveFolderId }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user?.googleDriveFolderId) return { files: [], error: "no_folder" };
    const files = await listDriveFiles(accessToken, user.googleDriveFolderId);
    return { files, error: null };
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  recordings: recordingsRouter,
  transcription: transcriptionRouter,
  summary: summaryRouter,
  mindMap: mindMapRouter,
  actionItems: actionItemsRouter,
  askAI: askAIRouter,
  googleDrive: googleDriveRouter,
});

export type AppRouter = typeof appRouter;
