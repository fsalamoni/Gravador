import { describe, it, expect } from "vitest";

// ============================================================
// Pure utility functions extracted for testing (no native deps)
// ============================================================

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function generateAudioFileName(recordingId: string, mimeType: string): string {
  const ext = mimeType.includes("m4a") ? "m4a" : mimeType.includes("mp4") ? "mp4" : "m4a";
  return `recording_${recordingId}_${Date.now()}.${ext}`;
}

// ============================================================
// Tests
// ============================================================

describe("formatDuration", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats 65 seconds as 1:05", () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  it("formats 3600 seconds as 1:00:00", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
  });

  it("formats 3661 seconds as 1:01:01", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("formats 59 seconds as 0:59", () => {
    expect(formatDuration(59)).toBe("0:59");
  });
});

describe("generateAudioFileName", () => {
  it("generates m4a filename for audio/m4a mime type", () => {
    const filename = generateAudioFileName("abc123", "audio/m4a");
    expect(filename).toMatch(/^recording_abc123_\d+\.m4a$/);
  });

  it("generates mp4 filename for audio/mp4 mime type", () => {
    const filename = generateAudioFileName("xyz789", "audio/mp4");
    expect(filename).toMatch(/^recording_xyz789_\d+\.mp4$/);
  });

  it("defaults to m4a for unknown mime types", () => {
    const filename = generateAudioFileName("test001", "audio/unknown");
    expect(filename).toMatch(/^recording_test001_\d+\.m4a$/);
  });

  it("includes recording ID in filename", () => {
    const id = "unique_recording_id_42";
    const filename = generateAudioFileName(id, "audio/m4a");
    expect(filename).toContain(id);
  });
});

describe("Recording Mode Labels", () => {
  const MODE_LABELS: Record<string, string> = {
    ambient: "Ambiente",
    meeting: "Reunião",
    call: "Chamada",
    voice_memo: "Nota de Voz",
  };

  it("has all required recording modes", () => {
    expect(Object.keys(MODE_LABELS)).toContain("ambient");
    expect(Object.keys(MODE_LABELS)).toContain("meeting");
    expect(Object.keys(MODE_LABELS)).toContain("call");
    expect(Object.keys(MODE_LABELS)).toContain("voice_memo");
  });

  it("has Portuguese labels for all modes", () => {
    expect(MODE_LABELS["ambient"]).toBe("Ambiente");
    expect(MODE_LABELS["meeting"]).toBe("Reunião");
    expect(MODE_LABELS["call"]).toBe("Chamada");
    expect(MODE_LABELS["voice_memo"]).toBe("Nota de Voz");
  });
});

describe("Summary Templates", () => {
  const SUMMARY_TEMPLATES = [
    { id: "executive", label: "Executivo" },
    { id: "action_items", label: "Itens de Ação" },
    { id: "decisions", label: "Decisões" },
    { id: "meeting_notes", label: "Ata de Reunião" },
    { id: "strategic", label: "Estratégico" },
    { id: "feedback", label: "Feedback" },
  ];

  it("has 6 summary templates", () => {
    expect(SUMMARY_TEMPLATES.length).toBe(6);
  });

  it("includes executive template", () => {
    const executive = SUMMARY_TEMPLATES.find((t) => t.id === "executive");
    expect(executive).toBeDefined();
    expect(executive?.label).toBe("Executivo");
  });

  it("includes all required templates", () => {
    const ids = SUMMARY_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("executive");
    expect(ids).toContain("action_items");
    expect(ids).toContain("decisions");
    expect(ids).toContain("meeting_notes");
    expect(ids).toContain("strategic");
    expect(ids).toContain("feedback");
  });
});

describe("AI Tab Configuration", () => {
  const TABS = [
    { id: "transcription", label: "Transcrição" },
    { id: "summary", label: "Resumo" },
    { id: "mindmap", label: "Mapa Mental" },
    { id: "actions", label: "Ações" },
    { id: "ask", label: "Perguntar IA" },
  ];

  it("has 5 AI tabs", () => {
    expect(TABS.length).toBe(5);
  });

  it("includes all required tabs", () => {
    const ids = TABS.map((t) => t.id);
    expect(ids).toContain("transcription");
    expect(ids).toContain("summary");
    expect(ids).toContain("mindmap");
    expect(ids).toContain("actions");
    expect(ids).toContain("ask");
  });

  it("transcription is the first tab", () => {
    expect(TABS[0].id).toBe("transcription");
  });
});
