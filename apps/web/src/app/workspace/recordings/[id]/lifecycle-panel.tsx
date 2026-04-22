'use client';

import type { AudioEditPreset, AudioVersionRecord } from '@/lib/audio-editing';
import type {
  ArtifactLifecycleStatus,
  RecordingLifecycleState,
  RecordingLifecycleStatus,
} from '@/lib/recording-lifecycle';
import { Archive, History, Loader2, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';

type ArtifactItem = {
  kind: string;
  artifactStatus: ArtifactLifecycleStatus;
  artifactVersion: number;
  updatedAt: string | null;
};

type LifecyclePanelProps = {
  recordingId: string;
  deletedAt: string | null;
  initialLifecycle: RecordingLifecycleState;
  audioEditingEnabled: boolean;
  initialAudioVersions: AudioVersionRecord[];
  initialArtifacts: ArtifactItem[];
};

type LifecycleAction = 'archive' | 'unarchive' | 'trash' | 'restore' | 'bumpVersion';

function statusBadge(status: RecordingLifecycleStatus) {
  if (status === 'trashed') return 'bg-danger/15 text-danger';
  if (status === 'archived') return 'bg-accent/15 text-accent';
  return 'bg-ok/15 text-ok';
}

function artifactBadge(status: ArtifactLifecycleStatus) {
  return status === 'deleted' ? 'bg-danger/10 text-danger' : 'bg-ok/10 text-ok';
}

export function LifecyclePanel({
  recordingId,
  deletedAt,
  initialLifecycle,
  audioEditingEnabled,
  initialAudioVersions,
  initialArtifacts,
}: LifecyclePanelProps) {
  const [lifecycle, setLifecycle] = useState(initialLifecycle);
  const [trashedAt, setTrashedAt] = useState<string | null>(deletedAt);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [audioVersions, setAudioVersions] = useState(initialAudioVersions);
  const [editPreset, setEditPreset] = useState<AudioEditPreset>('normalize_loudness');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refreshArtifacts = async () => {
    const res = await fetch(`/api/recordings/${recordingId}/artifacts`, { cache: 'no-store' });
    if (!res.ok) return;

    const data = (await res.json()) as {
      items?: Array<{
        kind?: string;
        lifecycle?: {
          artifactStatus?: ArtifactLifecycleStatus;
          artifactVersion?: number;
          updatedAt?: string | null;
        } | null;
      }>;
    };

    const next =
      data.items
        ?.map((item) => {
          if (!item.kind || !item.lifecycle) return null;
          return {
            kind: item.kind,
            artifactStatus: item.lifecycle.artifactStatus ?? 'active',
            artifactVersion: item.lifecycle.artifactVersion ?? 1,
            updatedAt: item.lifecycle.updatedAt ?? null,
          };
        })
        .filter((item): item is ArtifactItem => item !== null) ?? [];

    setArtifacts(next);
  };

  const runLifecycleAction = async (action: LifecycleAction) => {
    setBusyAction(action);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/lifecycle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        alert('Nao foi possivel atualizar o ciclo de vida da gravacao.');
        return;
      }

      const data = (await response.json()) as {
        lifecycle?: RecordingLifecycleState;
        deletedAt?: string | null;
      };

      if (data.lifecycle) setLifecycle(data.lifecycle);
      if (Object.prototype.hasOwnProperty.call(data, 'deletedAt')) {
        setTrashedAt(data.deletedAt ?? null);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const refreshAudioVersions = async () => {
    if (!audioEditingEnabled) return;
    const response = await fetch(`/api/recordings/${recordingId}/audio-editing`, {
      cache: 'no-store',
    });
    if (!response.ok) return;

    const data = (await response.json()) as {
      activeAudioVersionId?: string | null;
      items?: AudioVersionRecord[];
    };

    setAudioVersions(data.items ?? []);
    if (data.activeAudioVersionId) {
      setLifecycle((prev) => ({
        ...prev,
        activeAudioVersionId: data.activeAudioVersionId ?? null,
      }));
    }
  };

  const updateArtifactStatus = async (kind: string, action: 'delete' | 'restore') => {
    setBusyAction(`${action}:${kind}`);
    try {
      const url = `/api/recordings/${recordingId}/artifacts/${kind}`;
      const response = await fetch(url, {
        method: action === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        alert('Nao foi possivel atualizar o artefato.');
        return;
      }

      await refreshArtifacts();
      const lifecycleRes = await fetch(`/api/recordings/${recordingId}/lifecycle`, {
        cache: 'no-store',
      });
      if (lifecycleRes.ok) {
        const lifecycleData = (await lifecycleRes.json()) as {
          lifecycle?: RecordingLifecycleState;
          deletedAt?: string | null;
        };
        if (lifecycleData.lifecycle) setLifecycle(lifecycleData.lifecycle);
        if (Object.prototype.hasOwnProperty.call(lifecycleData, 'deletedAt')) {
          setTrashedAt(lifecycleData.deletedAt ?? null);
        }
      }
    } finally {
      setBusyAction(null);
    }
  };

  const queueAudioEdit = async () => {
    setBusyAction('audio:queue');
    try {
      const response = await fetch(`/api/recordings/${recordingId}/audio-editing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'queue_edit', preset: editPreset }),
      });

      if (!response.ok) {
        alert('Não foi possível enfileirar a edição de áudio.');
        return;
      }

      await refreshAudioVersions();
      const lifecycleRes = await fetch(`/api/recordings/${recordingId}/lifecycle`, {
        cache: 'no-store',
      });
      if (lifecycleRes.ok) {
        const lifecycleData = (await lifecycleRes.json()) as {
          lifecycle?: RecordingLifecycleState;
          deletedAt?: string | null;
        };
        if (lifecycleData.lifecycle) setLifecycle(lifecycleData.lifecycle);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const rollbackAudioVersion = async (targetVersionId: string) => {
    setBusyAction(`audio:rollback:${targetVersionId}`);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/audio-editing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', targetVersionId }),
      });
      if (!response.ok) {
        alert('Não foi possível executar rollback de áudio.');
        return;
      }

      await refreshAudioVersions();
      const lifecycleRes = await fetch(`/api/recordings/${recordingId}/lifecycle`, {
        cache: 'no-store',
      });
      if (lifecycleRes.ok) {
        const lifecycleData = (await lifecycleRes.json()) as {
          lifecycle?: RecordingLifecycleState;
        };
        if (lifecycleData.lifecycle) setLifecycle(lifecycleData.lifecycle);
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-mute">Lifecycle</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">Ciclo de vida da gravacao</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(lifecycle.status)}`}
        >
          {lifecycle.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-border bg-bg/55 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mute">Versao ativa</p>
          <p className="mt-2 text-2xl font-semibold text-text">v{lifecycle.recordingVersion}</p>
        </div>
        <div className="rounded-[18px] border border-border bg-bg/55 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mute">Versoes retidas</p>
          <p className="mt-2 text-2xl font-semibold text-text">{lifecycle.retainedVersions}</p>
        </div>
        <div className="rounded-[18px] border border-border bg-bg/55 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mute">Lixeira</p>
          <p className="mt-2 text-sm font-medium text-text">
            {trashedAt ? new Date(trashedAt).toLocaleString() : 'Nao enviado para lixeira'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {lifecycle.status === 'archived' ? (
          <button
            type="button"
            onClick={() => runLifecycleAction('unarchive')}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2 text-sm font-medium text-text transition hover:border-accent/40"
            disabled={busyAction !== null}
          >
            {busyAction === 'unarchive' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Desarquivar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => runLifecycleAction('archive')}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2 text-sm font-medium text-text transition hover:border-accent/40"
            disabled={busyAction !== null}
          >
            {busyAction === 'archive' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Arquivar
          </button>
        )}

        {lifecycle.status === 'trashed' ? (
          <button
            type="button"
            onClick={() => runLifecycleAction('restore')}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-ok/10 px-4 py-2 text-sm font-medium text-ok transition hover:border-ok/50"
            disabled={busyAction !== null}
          >
            {busyAction === 'restore' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Restaurar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => runLifecycleAction('trash')}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition hover:border-danger/50"
            disabled={busyAction !== null}
          >
            {busyAction === 'trash' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Enviar para lixeira
          </button>
        )}

        <button
          type="button"
          onClick={() => runLifecycleAction('bumpVersion')}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2 text-sm font-medium text-text transition hover:border-accent/40"
          disabled={busyAction !== null}
        >
          {busyAction === 'bumpVersion' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <History className="h-4 w-4" />
          )}
          Bump de versao
        </button>
      </div>

      <div className="mt-6 rounded-[18px] border border-border bg-bg/55 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <ShieldAlert className="h-4 w-4 text-accent" />
          Artefatos vinculados
        </div>

        {artifacts.length === 0 ? (
          <p className="mt-3 text-sm text-mute">Nenhum artefato registrado para esta gravacao.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {artifacts.map((artifact) => (
              <div
                key={artifact.kind}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-border bg-bg/70 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-text">{artifact.kind}</p>
                  <p className="text-xs text-mute">
                    v{artifact.artifactVersion}
                    {artifact.updatedAt
                      ? ` • ${new Date(artifact.updatedAt).toLocaleString()}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${artifactBadge(artifact.artifactStatus)}`}
                  >
                    {artifact.artifactStatus}
                  </span>
                  {artifact.artifactStatus === 'deleted' ? (
                    <button
                      type="button"
                      onClick={() => updateArtifactStatus(artifact.kind, 'restore')}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text transition hover:border-ok/50"
                      disabled={busyAction === `restore:${artifact.kind}`}
                    >
                      Restaurar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateArtifactStatus(artifact.kind, 'delete')}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-danger transition hover:border-danger/50"
                      disabled={busyAction === `delete:${artifact.kind}`}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {audioEditingEnabled ? (
        <div className="mt-6 rounded-[18px] border border-border bg-bg/55 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-text">Audio editing (FFmpeg)</p>
              <p className="text-xs text-mute">Versionamento + rollback sob feature flag.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="rounded-full border border-border bg-bg/70 px-3 py-1.5 text-xs text-text"
                value={editPreset}
                onChange={(event) => setEditPreset(event.target.value as AudioEditPreset)}
              >
                <option value="normalize_loudness">Normalizar loudness</option>
                <option value="trim_silence">Remover silêncios</option>
                <option value="denoise">Reduzir ruído</option>
              </select>
              <button
                type="button"
                onClick={queueAudioEdit}
                className="rounded-full border border-border bg-surfaceAlt/70 px-3 py-1.5 text-xs font-medium text-text transition hover:border-accent/40"
                disabled={busyAction !== null}
              >
                {busyAction === 'audio:queue' ? 'Enfileirando…' : 'Enfileirar edição'}
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {audioVersions.length === 0 ? (
              <p className="text-sm text-mute">Nenhuma versão de áudio registrada.</p>
            ) : (
              audioVersions.map((version) => {
                const isActive = lifecycle.activeAudioVersionId === version.id;
                const canRollback = !isActive && version.status === 'ready';
                return (
                  <div
                    key={version.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-border bg-bg/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-text">
                        v{version.versionNumber}
                        {version.isOriginal ? ' • original' : ''}
                      </p>
                      <p className="text-xs text-mute">
                        {version.status}
                        {version.editPreset ? ` • ${version.editPreset}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="rounded-full bg-ok/15 px-2.5 py-1 text-[11px] font-semibold text-ok">
                          ativa
                        </span>
                      ) : null}
                      {canRollback ? (
                        <button
                          type="button"
                          onClick={() => rollbackAudioVersion(version.id)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text transition hover:border-accent/40"
                          disabled={busyAction === `audio:rollback:${version.id}`}
                        >
                          {busyAction === `audio:rollback:${version.id}`
                            ? 'Aplicando…'
                            : 'Rollback'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
