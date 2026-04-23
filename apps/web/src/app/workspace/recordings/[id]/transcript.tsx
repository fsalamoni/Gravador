'use client';

import { formatDurationMs } from '@gravador/core';
import { Check, History, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

interface Segment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_id: string | null;
}

interface TranscriptData {
  id: string;
  full_text: string;
  detected_locale: string | null;
  transcript_version: number;
  updated_at: string | null;
  updated_by: string | null;
}

interface TranscriptRevision {
  id: string;
  from_version: number;
  to_version: number;
  previous_text: string;
  next_text: string;
  edited_by: string | null;
  created_at: string | null;
  source: 'manual_edit' | 'retranscribe';
}

interface Props {
  recordingId: string;
  transcript: TranscriptData | null;
  segments: Segment[];
  revisions: TranscriptRevision[];
}

type TranscriptApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function toDisplayDate(value: string | null): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return parsed.toLocaleString('pt-BR');
}

function shortenUid(value: string | null): string {
  if (!value) return 'system';
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export function TranscriptView({ recordingId, transcript, segments, revisions }: Props) {
  const router = useRouter();
  const sourceText = useMemo(() => {
    if (transcript?.full_text) return transcript.full_text;
    return segments.map((segment) => segment.text).join('\n');
  }, [transcript?.full_text, segments]);

  const [text, setText] = useState(sourceText);
  const [savedText, setSavedText] = useState(sourceText);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const dirty = text !== savedText;

  useEffect(() => {
    if (!dirty) {
      setText(sourceText);
      setSavedText(sourceText);
    }
  }, [sourceText, dirty]);

  const canSave = Boolean(transcript) && !saving && dirty && text.trim().length > 0;

  const saveTranscript = async () => {
    if (!transcript) {
      setSaveError('Execute a transcrição antes de editar o texto completo.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/recordings/${recordingId}/transcript`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullText: text }),
      });
      const data = (await res.json()) as TranscriptApiResponse;
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? 'Falha ao salvar transcrição.');
      }

      setSavedText(text);
      const nowIso = new Date().toISOString();
      setLastSavedAt(nowIso);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Erro inesperado ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!transcript && segments.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
        A transcrição aparecerá aqui quando o processamento terminar.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="rounded-[24px] border border-border bg-bg/55 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text">Texto completo da transcrição</h3>
            <p className="mt-1 text-xs text-mute">
              {transcript
                ? `Versão ${transcript.transcript_version} • idioma ${transcript.detected_locale ?? 'auto'}`
                : 'Texto derivado de segmentos (somente leitura até transcrição existir).'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveTranscript()}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-[14px] bg-accent px-4 py-2 text-xs font-semibold text-onAccent transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? 'Salvando...' : 'Salvar correção'}
          </button>
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={14}
          disabled={!transcript}
          className="mt-4 w-full resize-y rounded-[16px] border border-border bg-bg/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="O texto completo da transcrição aparecerá aqui."
        />

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className={dirty ? 'text-warning' : 'text-mute'}>
            {dirty ? 'Alterações não salvas' : 'Sem alterações pendentes'}
          </span>
          {lastSavedAt ? (
            <span className="inline-flex items-center gap-1 text-ok">
              <Check className="h-3 w-3" />
              Salvo agora ({toDisplayDate(lastSavedAt)})
            </span>
          ) : null}
          {transcript?.updated_at ? (
            <span className="text-mute">
              Última atualização: {toDisplayDate(transcript.updated_at)} por{' '}
              {shortenUid(transcript.updated_by)}
            </span>
          ) : null}
        </div>

        {saveError ? <p className="mt-2 text-xs text-danger">{saveError}</p> : null}
      </div>

      <div className="rounded-[24px] border border-border bg-bg/55 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-text">Histórico de alterações</h3>
        </div>

        {revisions.length === 0 ? (
          <p className="text-sm text-mute">Sem histórico de alterações manuais ainda.</p>
        ) : (
          <div className="space-y-2">
            {revisions.map((revision) => (
              <div
                key={revision.id}
                className="rounded-[14px] border border-border bg-bg/70 px-3 py-2"
              >
                <p className="text-xs text-text">
                  v{revision.from_version} → v{revision.to_version} •{' '}
                  {toDisplayDate(revision.created_at)}
                </p>
                <p className="mt-1 text-[11px] text-mute">
                  {revision.source === 'retranscribe' ? 'Re-transcrição' : 'Correção manual'} • por{' '}
                  {shortenUid(revision.edited_by)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {segments.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Segmentos temporais</h3>
          {segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek?.(
                  s.start_ms,
                )
              }
              aria-label={`Jump to ${formatDurationMs(s.start_ms)}`}
              className="group block w-full rounded-[24px] border border-border bg-bg/55 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surfaceAlt/80"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-mute">
                <span className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 font-mono text-accentSoft">
                  {formatDurationMs(s.start_ms)}
                </span>
                {s.speaker_id ? (
                  <span className="rounded-full border border-border px-3 py-1 text-[11px] text-mute">
                    Falante {s.speaker_id.slice(0, 6)}
                  </span>
                ) : null}
              </div>
              <p className="leading-8 text-text transition group-hover:text-white">{s.text}</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
