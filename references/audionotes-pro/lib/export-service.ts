/**
 * Export Service
 *
 * Handles exporting recording content (transcription, summaries, action items)
 * as Markdown, plain text, or via native share sheet.
 *
 * Uses expo-sharing (via expo-linking) and expo-file-system for file export.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";

export interface ExportData {
  title: string;
  recordingMode: string;
  duration: number;
  createdAt: string;
  transcription?: string | null;
  summary?: string | null;
  summaryTemplate?: string;
  actionItems?: Array<{
    text: string;
    priority: string;
    assignee?: string | null;
    dueDate?: string | null;
    isCompleted: boolean;
  }>;
  mindMapText?: string | null;
}

const MODE_LABELS: Record<string, string> = {
  ambient: "Ambiente",
  meeting: "Reunião",
  call: "Chamada",
  voice_memo: "Nota de Voz",
};

const TEMPLATE_LABELS: Record<string, string> = {
  executive: "Resumo Executivo",
  action_items: "Itens de Ação",
  decisions: "Decisões",
  feedback: "Feedback",
  strategic: "Estratégico",
  meeting_notes: "Ata de Reunião",
  custom: "Resumo Geral",
};

function formatDurationText(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}min ${s}s`;
}

/**
 * Generates a Markdown document from the recording data.
 */
export function generateMarkdown(data: ExportData): string {
  const lines: string[] = [];
  const date = new Date(data.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  lines.push(`# ${data.title}`);
  lines.push("");
  lines.push(`**Modo:** ${MODE_LABELS[data.recordingMode] || data.recordingMode}  `);
  lines.push(`**Duração:** ${formatDurationText(data.duration)}  `);
  lines.push(`**Data:** ${date}  `);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (data.transcription) {
    lines.push("## Transcrição");
    lines.push("");
    lines.push(data.transcription);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  if (data.summary) {
    const templateLabel = TEMPLATE_LABELS[data.summaryTemplate || "executive"] || "Resumo";
    lines.push(`## ${templateLabel}`);
    lines.push("");
    lines.push(data.summary);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  if (data.actionItems && data.actionItems.length > 0) {
    lines.push("## Itens de Ação");
    lines.push("");
    data.actionItems.forEach((item, i) => {
      const check = item.isCompleted ? "[x]" : "[ ]";
      const priority = item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢";
      let line = `${i + 1}. ${check} ${priority} ${item.text}`;
      if (item.assignee) line += ` — *${item.assignee}*`;
      if (item.dueDate) line += ` (${item.dueDate})`;
      lines.push(line);
    });
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("*Exportado pelo AudioNotes Pro*");

  return lines.join("\n");
}

/**
 * Generates plain text from the recording data.
 */
export function generatePlainText(data: ExportData): string {
  const lines: string[] = [];
  const date = new Date(data.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  lines.push(data.title.toUpperCase());
  lines.push("=".repeat(data.title.length));
  lines.push("");
  lines.push(`Modo: ${MODE_LABELS[data.recordingMode] || data.recordingMode}`);
  lines.push(`Duração: ${formatDurationText(data.duration)}`);
  lines.push(`Data: ${date}`);
  lines.push("");

  if (data.transcription) {
    lines.push("TRANSCRIÇÃO");
    lines.push("-".repeat(20));
    lines.push(data.transcription);
    lines.push("");
  }

  if (data.summary) {
    const templateLabel = TEMPLATE_LABELS[data.summaryTemplate || "executive"] || "Resumo";
    lines.push(templateLabel.toUpperCase());
    lines.push("-".repeat(20));
    lines.push(data.summary);
    lines.push("");
  }

  if (data.actionItems && data.actionItems.length > 0) {
    lines.push("ITENS DE AÇÃO");
    lines.push("-".repeat(20));
    data.actionItems.forEach((item, i) => {
      const check = item.isCompleted ? "[✓]" : "[ ]";
      const priority = item.priority === "high" ? "[ALTA]" : item.priority === "medium" ? "[MÉDIA]" : "[BAIXA]";
      lines.push(`${i + 1}. ${check} ${priority} ${item.text}`);
      if (item.assignee) lines.push(`   Responsável: ${item.assignee}`);
      if (item.dueDate) lines.push(`   Prazo: ${item.dueDate}`);
    });
    lines.push("");
  }

  lines.push("Exportado pelo AudioNotes Pro");

  return lines.join("\n");
}

/**
 * Copies text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

/**
 * Shares content via the native share sheet.
 * On iOS/Android: uses the system share sheet.
 * On web: falls back to clipboard copy.
 */
export async function shareContent(
  text: string,
  title: string,
): Promise<void> {
  if (Platform.OS === "web") {
    await copyToClipboard(text);
    return;
  }

  try {
    await Share.share({
      message: text,
      title,
    });
  } catch (error) {
    console.warn("[Export] Share failed:", error);
    // Fallback to clipboard
    await copyToClipboard(text);
  }
}

/**
 * Saves content to a file and shares it via the native share sheet.
 * Creates a temporary .md or .txt file in the cache directory.
 */
export async function shareAsFile(
  content: string,
  filename: string,
  mimeType: "text/markdown" | "text/plain",
): Promise<void> {
  if (Platform.OS === "web") {
    await copyToClipboard(content);
    return;
  }

  try {
    const ext = mimeType === "text/markdown" ? ".md" : ".txt";
    const fileUri = `${FileSystem.cacheDirectory}${filename}${ext}`;

    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: `Compartilhar ${filename}`,
        UTI: mimeType === "text/markdown" ? "net.daringfireball.markdown" : "public.plain-text",
      });
    } else {
      // Fallback to text share
      await shareContent(content, filename);
    }
  } catch (error) {
    console.warn("[Export] File share failed:", error);
    await shareContent(content, filename);
  }
}

/**
 * Main export function — generates Markdown and shares as file.
 */
export async function exportRecording(
  data: ExportData,
  format: "markdown" | "text" | "share",
): Promise<void> {
  const safeTitle = data.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, "").trim().substring(0, 50);

  if (format === "markdown") {
    const md = generateMarkdown(data);
    await shareAsFile(md, safeTitle, "text/markdown");
  } else if (format === "text") {
    const txt = generatePlainText(data);
    await shareAsFile(txt, safeTitle, "text/plain");
  } else {
    // Quick share: just the transcription or summary as text
    const text = data.transcription || data.summary || data.title;
    await shareContent(text, data.title);
  }
}
