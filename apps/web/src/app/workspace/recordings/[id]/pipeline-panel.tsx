'use client';

import {
  AlertCircle,
  BookMarked,
  BookOpen,
  CheckSquare,
  CreditCard,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Play,
  PlayCircle,
  Quote,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useState } from 'react';

type TaskKind =
  | 'transcribe'
  | 'summary'
  | 'actionItems'
  | 'mindmap'
  | 'chapters'
  | 'quotes'
  | 'sentiment'
  | 'flashcards'
  | 'embed';

type TaskStatus = 'idle' | 'running' | 'done' | 'failed';

interface TaskDef {
  id: TaskKind;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  requiresTranscript: boolean;
  pipelineKey: string;
}

const TASKS: TaskDef[] = [
  {
    id: 'transcribe',
    label: 'Transcrição',
    description: 'Converte o áudio em texto via Whisper',
    icon: FileText,
    requiresTranscript: false,
    pipelineKey: 'transcribe',
  },
  {
    id: 'summary',
    label: 'Resumo',
    description: 'TLDR, bullet points e resumo completo',
    icon: BookOpen,
    requiresTranscript: true,
    pipelineKey: 'summary',
  },
  {
    id: 'actionItems',
    label: 'Itens de Ação',
    description: 'Extrai tarefas e responsáveis da conversa',
    icon: CheckSquare,
    requiresTranscript: true,
    pipelineKey: 'action_items',
  },
  {
    id: 'mindmap',
    label: 'Mapa Mental',
    description: 'Estrutura os tópicos em hierarquia visual',
    icon: GitBranch,
    requiresTranscript: true,
    pipelineKey: 'mindmap',
  },
  {
    id: 'chapters',
    label: 'Capítulos',
    description: 'Divide o conteúdo em seções navegáveis',
    icon: BookMarked,
    requiresTranscript: true,
    pipelineKey: 'chapters',
  },
  {
    id: 'quotes',
    label: 'Citações',
    description: 'Identifica as frases-chave mais relevantes',
    icon: Quote,
    requiresTranscript: true,
    pipelineKey: 'quotes',
  },
  {
    id: 'sentiment',
    label: 'Sentimento',
    description: 'Analisa o tom emocional da conversa',
    icon: TrendingUp,
    requiresTranscript: true,
    pipelineKey: 'sentiment',
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    description: 'Cria cartões de estudo do conteúdo',
    icon: CreditCard,
    requiresTranscript: true,
    pipelineKey: 'flashcards',
  },
  {
    id: 'embed',
    label: 'Embeddings',
    description: 'Indexa para busca semântica no Chat (OpenAI ou fallback local)',
    icon: Layers,
    requiresTranscript: true,
    pipelineKey: 'embed',
  },
];

interface Props {
  recordingId: string;
  hasTranscript: boolean;
  initialPipelineResults?: Record<string, 'ok' | 'failed'>;
}

type ApiResponse = { ok?: boolean; message?: string; error?: string };

function resolveServerTaskStatus(
  task: TaskDef,
  hasTranscript: boolean,
  pipelineResults: Record<string, 'ok' | 'failed'>,
): TaskStatus {
  const existing = pipelineResults[task.pipelineKey];
  if (task.id === 'transcribe') {
    return hasTranscript || existing === 'ok' ? 'done' : existing === 'failed' ? 'failed' : 'idle';
  }
  return existing === 'ok' ? 'done' : existing === 'failed' ? 'failed' : 'idle';
}

export function PipelinePanel({ recordingId, hasTranscript, initialPipelineResults = {} }: Props) {
  const router = useRouter();

  const [taskStatus, setTaskStatus] = useState<Record<TaskKind, TaskStatus>>(() => {
    const init = {} as Record<TaskKind, TaskStatus>;
    for (const t of TASKS) {
      init[t.id] = resolveServerTaskStatus(t, hasTranscript, initialPipelineResults);
    }
    return init;
  });

  const [taskErrors, setTaskErrors] = useState<Partial<Record<TaskKind, string>>>({});
  const [runAllRunning, setRunAllRunning] = useState(false);

  useEffect(() => {
    setTaskStatus((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const task of TASKS) {
        if (prev[task.id] === 'running') continue;
        const serverStatus = resolveServerTaskStatus(task, hasTranscript, initialPipelineResults);
        if (next[task.id] !== serverStatus) {
          next[task.id] = serverStatus;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [hasTranscript, initialPipelineResults]);

  // Returns true on success, false on failure
  const callTask = useCallback(
    async (taskId: TaskKind): Promise<boolean> => {
      setTaskStatus((prev) => ({ ...prev, [taskId]: 'running' }));
      setTaskErrors((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      try {
        const res = await fetch(`/api/recordings/${recordingId}/run-task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: taskId }),
        });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok) throw new Error(data.message ?? data.error ?? 'Falha na tarefa');
        setTaskStatus((prev) => ({ ...prev, [taskId]: 'done' }));
        router.refresh();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro inesperado';
        setTaskStatus((prev) => ({ ...prev, [taskId]: 'failed' }));
        setTaskErrors((prev) => ({ ...prev, [taskId]: msg }));
        return false;
      }
    },
    [recordingId, router],
  );

  const runAll = useCallback(async () => {
    setRunAllRunning(true);
    const transcriptReady =
      hasTranscript || taskStatus.transcribe === 'done' || taskStatus.transcribe === 'running';

    if (!transcriptReady) {
      const ok = await callTask('transcribe');
      if (!ok) {
        setRunAllRunning(false);
        return;
      }
    }

    const aiTasks = TASKS.filter(
      (task) => task.requiresTranscript && taskStatus[task.id] !== 'running',
    );
    await Promise.allSettled(aiTasks.map((task) => callTask(task.id)));
    setRunAllRunning(false);
  }, [hasTranscript, taskStatus, callTask]);

  const anyRunning = Object.values(taskStatus).some((s) => s === 'running');
  const transcriptAvailable = hasTranscript || taskStatus.transcribe === 'done';
  const runnableAiTasks = TASKS.filter(
    (task) => task.requiresTranscript && taskStatus[task.id] !== 'running',
  ).length;
  const canRunAll = transcriptAvailable ? runnableAiTasks > 0 : taskStatus.transcribe !== 'running';
  const doneCount = Object.values(taskStatus).filter((s) => s === 'done').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">Processamento com IA</h2>
          <p className="mt-0.5 text-sm text-mute">
            Inicie cada tarefa individualmente ou todas de uma vez. As tarefas de IA rodam em
            paralelo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-mute">
            {doneCount}/{TASKS.length} concluídas
          </span>
          <button
            type="button"
            onClick={runAll}
            disabled={!canRunAll || runAllRunning}
            className="inline-flex items-center gap-2 rounded-[18px] bg-accent px-5 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runAllRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {runAllRunning ? 'Rodando...' : 'Iniciar Tudo'}
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      {doneCount > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surfaceAlt">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(doneCount / TASKS.length) * 100}%` }}
          />
        </div>
      )}

      {/* Task grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TASKS.map((task) => {
          const status = taskStatus[task.id];
          const Icon = task.icon;
          const canRun = status !== 'running' && !(task.requiresTranscript && !transcriptAvailable);
          const errorMsg = taskErrors[task.id];

          return (
            <div
              key={task.id}
              className={`rounded-[22px] border p-4 transition-all ${
                status === 'done'
                  ? 'border-ok/25 bg-ok/5'
                  : status === 'failed'
                    ? 'border-danger/25 bg-danger/5'
                    : status === 'running'
                      ? 'border-accent/35 bg-accent/5'
                      : 'border-border bg-bg/55'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                {/* Icon + labels */}
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`mt-0.5 shrink-0 rounded-xl p-2 ${
                      status === 'done'
                        ? 'bg-ok/15 text-ok'
                        : status === 'failed'
                          ? 'bg-danger/15 text-danger'
                          : status === 'running'
                            ? 'bg-accent/15 text-accent'
                            : 'bg-surfaceAlt text-mute'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text">{task.label}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-mute">
                      {task.description}
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <div className="shrink-0">
                  {status === 'running' ? (
                    <div className="flex h-7 w-7 items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    </div>
                  ) : status === 'done' ? (
                    <button
                      type="button"
                      onClick={() => canRun && void callTask(task.id)}
                      disabled={!canRun}
                      title="Refazer"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-ok/15 transition hover:bg-ok/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-ok" />
                    </button>
                  ) : status === 'failed' ? (
                    <button
                      type="button"
                      onClick={() => canRun && void callTask(task.id)}
                      disabled={!canRun}
                      title="Tentar novamente"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-danger/15 transition hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-danger" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => canRun && void callTask(task.id)}
                      disabled={!canRun}
                      title={
                        task.requiresTranscript && !transcriptAvailable
                          ? 'Requer transcrição primeiro'
                          : `Iniciar ${task.label}`
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-onAccent transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Play className="ml-0.5 h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Per-task progress bar while running */}
              {status === 'running' && (
                <div className="mt-3 space-y-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-accent/20">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
                  </div>
                  <p className="text-[11px] font-medium text-accent">Processando…</p>
                </div>
              )}

              {/* Error detail */}
              {status === 'failed' && errorMsg && (
                <div className="mt-2 flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-danger" />
                  <p className="line-clamp-2 text-[11px] text-danger">{errorMsg}</p>
                </div>
              )}

              {/* Dependency hint */}
              {status === 'idle' && task.requiresTranscript && !transcriptAvailable && (
                <p className="mt-2 text-[11px] text-mute/60">Requer transcrição primeiro</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
