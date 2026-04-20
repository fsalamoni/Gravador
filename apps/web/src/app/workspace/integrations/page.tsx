'use client';

import {
  Calendar,
  Check,
  Cloud,
  ExternalLink,
  HardDrive,
  Link2,
  Loader2,
  MessageCircle,
  Unplug,
  X,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────── */

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  status: 'disconnected' | 'connected' | 'connecting';
  connectedAt?: string;
  connectedEmail?: string;
}

/* ── Page component ────────────────────────────────────────── */

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'google-drive',
      name: 'Google Drive',
      description:
        'Sincronize gravações, transcrições e relatórios de IA automaticamente com pastas do seu Google Drive.',
      icon: Cloud,
      iconColor: 'text-ok',
      status: 'disconnected',
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description:
        'Vincule gravações a eventos do calendário e receba resumos automaticamente nos seus compromissos.',
      icon: Calendar,
      iconColor: 'text-accent',
      status: 'disconnected',
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      description:
        'Faça backup automático de transcrições e relatórios para o OneDrive pessoal ou corporativo (Microsoft 365).',
      icon: HardDrive,
      iconColor: 'text-[#0078d4]',
      status: 'disconnected',
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description:
        'Envie exportações em JSON ou Markdown para o Dropbox automaticamente após o processamento de cada gravação.',
      icon: Link2,
      iconColor: 'text-[#0061ff]',
      status: 'disconnected',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description:
        'Receba notificações e resumos das gravações diretamente no seu WhatsApp via webhook configurável.',
      icon: MessageCircle,
      iconColor: 'text-[#25d366]',
      status: 'disconnected',
    },
  ]);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (!connected && !error) return;

    if (connected) {
      setToast(`Integração ${connected} conectada com sucesso.`);
    }
    if (error) {
      setToast(`Falha na conexão: ${error}`);
    }

    const cleaned = new URL(window.location.href);
    cleaned.searchParams.delete('connected');
    cleaned.searchParams.delete('error');
    window.history.replaceState({}, '', cleaned.toString());
  }, [searchParams]);

  // Load integration statuses from server
  useEffect(() => {
    fetch('/api/integrations')
      .then((r) => r.json())
      .then((data) => {
        if (data.integrations) {
          setIntegrations((prev) =>
            prev.map((i) => {
              const remote = (
                data.integrations as Array<{
                  id: string;
                  status: string;
                  connectedAt?: string;
                  connectedEmail?: string;
                }>
              ).find((ri) => ri.id === i.id);
              if (remote && remote.status === 'connected') {
                return {
                  ...i,
                  status: 'connected' as const,
                  connectedAt: remote.connectedAt,
                  connectedEmail: remote.connectedEmail,
                };
              }
              return i;
            }),
          );
        }
      })
      .catch(() => {});
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleConnect = useCallback(
    async (integrationId: string) => {
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integrationId ? { ...i, status: 'connecting' as const } : i)),
      );

      try {
        let payload: { integrationId: string; webhookUrl?: string; phoneNumber?: string } = {
          integrationId,
        };

        if (integrationId === 'whatsapp') {
          const webhookUrl = window.prompt('Informe a URL do webhook do WhatsApp:')?.trim();
          if (!webhookUrl) throw new Error('Conexão cancelada: webhook é obrigatório.');
          const phoneNumber =
            window.prompt('Informe o número (opcional, ex: +55 11 99999-9999):')?.trim() ||
            undefined;
          payload = { integrationId, webhookUrl, phoneNumber };
        }

        const res = await fetch('/api/integrations/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          throw new Error(body?.message ?? `Falha ao conectar (HTTP ${res.status})`);
        }

        const data = (await res.json()) as { redirectUrl?: string; status?: string };

        if (data.redirectUrl) {
          // OAuth flow — redirect to provider
          window.location.href = data.redirectUrl;
          return;
        }

        // Direct connection (e.g. webhook-based)
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? {
                  ...i,
                  status: 'connected' as const,
                  connectedAt: new Date().toISOString(),
                }
              : i,
          ),
        );
        showToast(`${integrationId} conectado com sucesso!`);
      } catch (err) {
        setIntegrations((prev) =>
          prev.map((i) => (i.id === integrationId ? { ...i, status: 'disconnected' as const } : i)),
        );
        showToast(err instanceof Error ? err.message : 'Erro ao conectar. Tente novamente.');
      }
    },
    [showToast],
  );

  const handleDisconnect = useCallback(
    async (integrationId: string) => {
      try {
        await fetch('/api/integrations/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId }),
        });
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? {
                  ...i,
                  status: 'disconnected' as const,
                  connectedAt: undefined,
                  connectedEmail: undefined,
                }
              : i,
          ),
        );
        showToast('Integração desconectada.');
      } catch {
        showToast('Erro ao desconectar.');
      }
    },
    [showToast],
  );

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* Toast notification */}
      {toast && (
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-[18px] border border-border bg-surface px-5 py-3 text-sm text-text shadow-lg">
          <Check className="h-4 w-4 text-ok" />
          {toast}
          <button type="button" onClick={() => setToast(null)}>
            <X className="h-3.5 w-3.5 text-mute" />
          </button>
        </div>
      )}

      {/* Header */}
      <section className="card px-6 py-7 sm:px-7">
        <div>
          <span className="eyebrow">Conectar serviços</span>
          <h1 className="display-title mt-5 text-5xl leading-[0.96]">Integrações</h1>
          <p className="mt-4 max-w-3xl leading-8 text-mute">
            Conecte seus serviços favoritos para sincronizar gravações, transcrições e relatórios
            automaticamente. Cada integração usa OAuth seguro para autorização.
          </p>
        </div>
      </section>

      {/* Integration cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isConnected = integration.status === 'connected';
          const isConnecting = integration.status === 'connecting';

          return (
            <div key={integration.id} className="card p-6">
              <div className="flex items-center justify-between gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    isConnected ? 'bg-ok/15' : 'bg-surfaceAlt/70'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isConnected ? 'text-ok' : integration.iconColor}`} />
                </div>
                {isConnected && (
                  <span className="flex items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1 text-xs font-medium text-ok">
                    <Check className="h-3.5 w-3.5" />
                    Conectado
                  </span>
                )}
              </div>

              <div className="mt-4 text-xl font-semibold text-text">{integration.name}</div>
              <div className="mt-2 text-sm leading-6 text-mute">{integration.description}</div>

              {isConnected && integration.connectedEmail && (
                <div className="mt-3 text-xs text-mute">
                  Conta: <span className="text-text">{integration.connectedEmail}</span>
                </div>
              )}
              {isConnected && integration.connectedAt && (
                <div className="mt-1 text-xs text-mute">
                  Conectado em:{' '}
                  <span className="text-text">
                    {new Date(integration.connectedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}

              <div className="mt-5">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(integration.id)}
                    className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/20"
                  >
                    <Unplug className="h-4 w-4" />
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => handleConnect(integration.id)}
                    className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Conectando…
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        {integration.id === 'whatsapp' ? 'Configurar e conectar' : 'Conectar'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
