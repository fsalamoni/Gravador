'use client';

import {
  Calendar,
  Check,
  Cloud,
  Copy,
  ExternalLink,
  HardDrive,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Unplug,
  X,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type IntegrationId =
  | 'google-drive'
  | 'google-calendar'
  | 'onedrive'
  | 'dropbox'
  | 'whatsapp'
  | 'email';

interface Integration {
  id: IntegrationId;
  name: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  status: 'disconnected' | 'connected' | 'connecting';
  connectedAt?: string | null;
  connectedEmail?: string | null;
  targetFolder?: string | null;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  deliveryMode?: 'webhook' | 'meta-cloud' | null;
  receiveUrl?: string | null;
  receiveToken?: string | null;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  lastSentAt?: string | null;
}

const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description:
      'Sincronize backups reais das gravações em áudio, JSON e Markdown com uma pasta dedicada do seu Google Drive.',
    icon: Cloud,
    iconColor: 'text-ok',
    status: 'disconnected',
    targetFolder: '/Gravador',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description:
      'Conexão OAuth pronta para fluxos de agenda; a sincronização operacional continua separada do backup de arquivos.',
    icon: Calendar,
    iconColor: 'text-accent',
    status: 'disconnected',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description:
      'Envie pacotes completos de backup para o OneDrive pessoal ou corporativo, em uma pasta configurável.',
    icon: HardDrive,
    iconColor: 'text-[#0078d4]',
    status: 'disconnected',
    targetFolder: '/Apps/Gravador',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description:
      'Faça backup do áudio bruto e das exportações da gravação em uma estrutura pronta para Dropbox.',
    icon: Link2,
    iconColor: 'text-[#0061ff]',
    status: 'disconnected',
    targetFolder: '/Apps/Gravador',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description:
      'Envie gravações pelo WhatsApp Cloud API oficial e, se quiser, adicione um webhook para automações personalizadas.',
    icon: MessageCircle,
    iconColor: 'text-[#25d366]',
    status: 'disconnected',
  },
  {
    id: 'email',
    name: 'E-mail',
    description:
      'Dispare notificações por e-mail para eventos de lifecycle e conclusão de processamento com fluxo de teste e envio real.',
    icon: Mail,
    iconColor: 'text-[#f97316]',
    status: 'disconnected',
  },
];

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [toast, setToast] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [setupModalIntegration, setSetupModalIntegration] = useState<IntegrationId | null>(null);
  const [setupForm, setSetupForm] = useState<{
    phoneNumber: string;
    webhookUrl: string;
    emailAddress: string;
  }>({ phoneNumber: '', webhookUrl: '', emailAddress: '' });

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (!connected && !error) return;

    if (connected) setToast(`Integração ${connected} conectada com sucesso.`);
    if (error) setToast(`Falha na conexão: ${error}`);

    const cleaned = new URL(window.location.href);
    cleaned.searchParams.delete('connected');
    cleaned.searchParams.delete('error');
    window.history.replaceState({}, '', cleaned.toString());
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/integrations')
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data.integrations)) return;
        setIntegrations((prev) =>
          prev.map((integration) => {
            const remote = data.integrations.find(
              (item: { id: string }) => item.id === integration.id,
            ) as Partial<Integration> | undefined;
            if (!remote) return integration;
            return {
              ...integration,
              ...remote,
              status: remote.status === 'connected' ? 'connected' : integration.status,
            };
          }),
        );
      })
      .catch(() => {});
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const storageIntegrations = useMemo(
    () => new Set<IntegrationId>(['google-drive', 'onedrive', 'dropbox']),
    [],
  );

  const patchIntegration = useCallback(
    (integrationId: IntegrationId, patch: Partial<Integration>) => {
      setIntegrations((prev) =>
        prev.map((item) => (item.id === integrationId ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const handleConnect = useCallback(
    async (integrationId: IntegrationId) => {
      if (integrationId === 'whatsapp' || integrationId === 'email') {
        const existing = integrations.find((item) => item.id === integrationId);
        setSetupForm({
          phoneNumber: existing?.phoneNumber ?? '',
          webhookUrl: '',
          emailAddress: existing?.emailAddress ?? existing?.connectedEmail ?? '',
        });
        setSetupModalIntegration(integrationId);
        return;
      }
      patchIntegration(integrationId, { status: 'connecting' });
      try {
        const payload: { integrationId: IntegrationId; webhookUrl?: string; phoneNumber?: string } =
          {
            integrationId,
          };

        const res = await fetch('/api/integrations/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as {
          redirectUrl?: string;
          message?: string;
          receiveUrl?: string;
          inboundToken?: string;
        } | null;

        if (!res.ok) {
          throw new Error(data?.message ?? `Falha ao conectar (HTTP ${res.status})`);
        }

        if (data?.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }

        patchIntegration(integrationId, {
          status: 'connected',
          connectedAt: new Date().toISOString(),
          receiveUrl: data?.receiveUrl,
          receiveToken: data?.inboundToken,
        });
        showToast(`${integrationId} conectado com sucesso!`);
      } catch (error) {
        patchIntegration(integrationId, { status: 'disconnected' });
        showToast(error instanceof Error ? error.message : 'Erro ao conectar.');
      }
    },
    [integrations, patchIntegration, showToast],
  );

  const handleDisconnect = useCallback(
    async (integrationId: IntegrationId) => {
      setBusyKey(`disconnect:${integrationId}`);
      try {
        await fetch('/api/integrations/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId }),
        });
        patchIntegration(integrationId, {
          status: 'disconnected',
          connectedAt: null,
          connectedEmail: null,
          receiveToken: null,
          receiveUrl: null,
          lastSyncedAt: null,
          lastSyncError: null,
          lastSyncStatus: null,
          lastSentAt: null,
        });
        showToast('Integração desconectada.');
      } catch {
        showToast('Erro ao desconectar.');
      } finally {
        setBusyKey(null);
      }
    },
    [patchIntegration, showToast],
  );

  const handleSubmitGuidedSetup = useCallback(async () => {
    if (!setupModalIntegration) return;
    const integrationId = setupModalIntegration;
    setBusyKey(`connect:${integrationId}`);
    patchIntegration(integrationId, { status: 'connecting' });

    try {
      const payload: {
        integrationId: IntegrationId;
        webhookUrl?: string;
        phoneNumber?: string;
        emailAddress?: string;
      } = { integrationId };

      if (integrationId === 'whatsapp') {
        payload.phoneNumber = setupForm.phoneNumber;
        if (setupForm.webhookUrl.trim()) payload.webhookUrl = setupForm.webhookUrl.trim();
      }
      if (integrationId === 'email') {
        payload.emailAddress = setupForm.emailAddress;
      }

      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        receiveUrl?: string;
        inboundToken?: string;
        emailAddress?: string;
      } | null;
      if (!res.ok) throw new Error(data?.message ?? `Falha ao conectar (${res.status})`);

      patchIntegration(integrationId, {
        status: 'connected',
        connectedAt: new Date().toISOString(),
        receiveUrl: data?.receiveUrl ?? null,
        receiveToken: data?.inboundToken ?? null,
        phoneNumber: integrationId === 'whatsapp' ? setupForm.phoneNumber : null,
        emailAddress:
          integrationId === 'email' ? (data?.emailAddress ?? setupForm.emailAddress) : null,
        connectedEmail:
          integrationId === 'email' ? (data?.emailAddress ?? setupForm.emailAddress) : null,
      });

      setSetupModalIntegration(null);
      showToast('Integração conectada com sucesso.');
    } catch (error) {
      patchIntegration(integrationId, { status: 'disconnected' });
      showToast(error instanceof Error ? error.message : 'Erro ao conectar integração.');
    } finally {
      setBusyKey(null);
    }
  }, [patchIntegration, setupForm, setupModalIntegration, showToast]);

  const handleSendTest = useCallback(
    async (integrationId: IntegrationId) => {
      setBusyKey(`test:${integrationId}`);
      try {
        const res = await fetch('/api/integrations/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId, mode: 'test' }),
        });
        const data = (await res.json().catch(() => null)) as {
          failures?: Array<{ message: string }>;
          notificationsEnabled?: boolean;
        } | null;
        if (!res.ok)
          throw new Error(data?.failures?.[0]?.message ?? `Falha no teste (${res.status})`);
        if (data?.notificationsEnabled === false) {
          showToast('Notificações estão temporariamente desativadas.');
          return;
        }
        showToast('Envio de teste concluído.');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Erro ao executar teste.');
      } finally {
        setBusyKey(null);
      }
    },
    [showToast],
  );

  const handleSaveSettings = useCallback(
    async (integration: Integration) => {
      setBusyKey(`save:${integration.id}`);
      try {
        const res = await fetch('/api/integrations/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integrationId: integration.id,
            targetFolder: integration.targetFolder,
            phoneNumber: integration.phoneNumber,
            emailAddress: integration.emailAddress,
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? `Falha ao salvar (${res.status})`);
        showToast('Configuração salva.');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Erro ao salvar integração.');
      } finally {
        setBusyKey(null);
      }
    },
    [showToast],
  );

  const handleSync = useCallback(
    async (integrationId: IntegrationId) => {
      setBusyKey(`sync:${integrationId}`);
      try {
        const res = await fetch('/api/integrations/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId }),
        });
        const data = (await res.json().catch(() => null)) as {
          status?: string;
          failures?: Array<{ message: string }>;
        } | null;
        if (!res.ok) {
          throw new Error(data?.failures?.[0]?.message ?? `Falha ao sincronizar (${res.status})`);
        }
        patchIntegration(integrationId, {
          lastSyncedAt: new Date().toISOString(),
          lastSyncStatus: data?.status === 'partial' ? 'partial' : 'ok',
          lastSyncError: data?.status === 'partial' ? (data.failures?.[0]?.message ?? null) : null,
          ...(integrationId === 'whatsapp' ? { lastSentAt: new Date().toISOString() } : {}),
        });
        showToast(
          integrationId === 'whatsapp'
            ? 'Sincronização do WhatsApp concluída.'
            : 'Sincronização concluída com sucesso.',
        );
      } catch (error) {
        patchIntegration(integrationId, {
          lastSyncStatus: 'failed',
          lastSyncError: error instanceof Error ? error.message : 'Erro na sincronização.',
        });
        showToast(error instanceof Error ? error.message : 'Erro ao sincronizar.');
      } finally {
        setBusyKey(null);
      }
    },
    [patchIntegration, showToast],
  );

  const handleCopy = useCallback(
    (value: string, label: string) => {
      navigator.clipboard
        .writeText(value)
        .then(() => showToast(`${label} copiado.`))
        .catch(() => showToast(`Não foi possível copiar ${label.toLowerCase()}.`));
    },
    [showToast],
  );

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-[18px] border border-border bg-surface px-5 py-3 text-sm text-text shadow-lg">
          <Check className="h-4 w-4 text-ok" />
          {toast}
          <button type="button" onClick={() => setToast(null)}>
            <X className="h-3.5 w-3.5 text-mute" />
          </button>
        </div>
      )}

      <section className="card px-6 py-7 sm:px-7">
        <div>
          <span className="eyebrow">Conectar serviços</span>
          <h1 className="display-title mt-5 text-5xl leading-[0.96]">Integrações</h1>
          <p className="mt-4 max-w-3xl leading-8 text-mute">
            Agora as integrações fazem backup real: Google Drive, OneDrive e Dropbox recebem áudio
            bruto + exportações; o WhatsApp pode disparar payloads e também receber áudios para
            criar gravações automaticamente no banco.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isConnected = integration.status === 'connected';
          const isConnecting = integration.status === 'connecting';
          const syncBusy = busyKey === `sync:${integration.id}`;
          const testBusy = busyKey === `test:${integration.id}`;
          const saveBusy = busyKey === `save:${integration.id}`;
          const disconnectBusy = busyKey === `disconnect:${integration.id}`;
          const isStorage = storageIntegrations.has(integration.id);

          return (
            <div key={integration.id} className="card flex flex-col p-6">
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
                    {new Date(integration.connectedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              {isConnected && isStorage && (
                <div className="mt-4 space-y-3 rounded-[18px] border border-border bg-bg/45 p-4">
                  <div>
                    <label
                      htmlFor={`${integration.id}-target-folder`}
                      className="text-xs uppercase tracking-[0.24em] text-mute"
                    >
                      Pasta de backup
                    </label>
                    <input
                      id={`${integration.id}-target-folder`}
                      value={integration.targetFolder ?? ''}
                      onChange={(event) =>
                        patchIntegration(integration.id, { targetFolder: event.target.value })
                      }
                      placeholder="/Apps/Gravador"
                      className="mt-2 w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleSaveSettings(integration)}
                      disabled={saveBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-surfaceAlt disabled:opacity-50"
                    >
                      {saveBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar pasta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTest(integration.id)}
                      disabled={testBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-surfaceAlt/90 px-4 py-2.5 text-sm font-semibold text-text transition hover:bg-surfaceAlt disabled:opacity-50"
                    >
                      {testBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar teste
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSync(integration.id)}
                      disabled={syncBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft disabled:opacity-50"
                    >
                      {syncBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sincronizar backups
                    </button>
                  </div>
                </div>
              )}

              {isConnected && integration.id === 'whatsapp' && (
                <div className="mt-4 space-y-3 rounded-[18px] border border-border bg-bg/45 p-4">
                  <div>
                    <label
                      htmlFor={`${integration.id}-phone-number`}
                      className="text-xs uppercase tracking-[0.24em] text-mute"
                    >
                      Número de destino
                    </label>
                    <input
                      id={`${integration.id}-phone-number`}
                      value={integration.phoneNumber ?? ''}
                      onChange={(event) =>
                        patchIntegration(integration.id, { phoneNumber: event.target.value })
                      }
                      placeholder="+55 11 99999-9999"
                      className="mt-2 w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
                    />
                  </div>
                  <div className="rounded-[16px] border border-border bg-surfaceAlt/50 p-3 text-xs leading-5 text-mute">
                    <div className="font-semibold text-text">Webhook de entrada</div>
                    <p className="mt-1">
                      Configure sua automação para enviar áudios recebidos ao endpoint abaixo com o
                      token informado no header <code>x-gravador-integration-token</code>.
                    </p>
                    {integration.receiveUrl && (
                      <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-bg/80 px-3 py-2">
                        <span className="truncate">{integration.receiveUrl}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(integration.receiveUrl!, 'Endpoint')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {integration.receiveToken && (
                      <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-bg/80 px-3 py-2">
                        <span className="truncate">{integration.receiveToken}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(integration.receiveToken!, 'Token')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleSaveSettings(integration)}
                      disabled={saveBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-surfaceAlt disabled:opacity-50"
                    >
                      {saveBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar número
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSync(integration.id)}
                      disabled={syncBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft disabled:opacity-50"
                    >
                      {syncBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar último payload
                    </button>
                  </div>
                </div>
              )}

              {isConnected && integration.id === 'email' && (
                <div className="mt-4 space-y-3 rounded-[18px] border border-border bg-bg/45 p-4">
                  <div>
                    <label
                      htmlFor={`${integration.id}-email-address`}
                      className="text-xs uppercase tracking-[0.24em] text-mute"
                    >
                      E-mail de destino
                    </label>
                    <input
                      id={`${integration.id}-email-address`}
                      value={integration.emailAddress ?? ''}
                      onChange={(event) =>
                        patchIntegration(integration.id, { emailAddress: event.target.value })
                      }
                      placeholder="seu-email@empresa.com"
                      className="mt-2 w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleSaveSettings(integration)}
                      disabled={saveBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-surfaceAlt disabled:opacity-50"
                    >
                      {saveBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar e-mail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTest(integration.id)}
                      disabled={testBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-surfaceAlt/90 px-4 py-2.5 text-sm font-semibold text-text transition hover:bg-surfaceAlt disabled:opacity-50"
                    >
                      {testBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar teste
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSync(integration.id)}
                    disabled={syncBusy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {syncBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar última gravação por e-mail
                  </button>
                </div>
              )}

              {isConnected &&
                (integration.lastSyncedAt ||
                  integration.lastSyncError ||
                  integration.lastSentAt) && (
                  <div className="mt-4 rounded-[16px] border border-border bg-surfaceAlt/45 px-4 py-3 text-xs leading-5 text-mute">
                    {integration.lastSyncedAt && (
                      <div>
                        Última ação: {new Date(integration.lastSyncedAt).toLocaleString('pt-BR')}
                      </div>
                    )}
                    {integration.lastSentAt && (
                      <div>
                        Último envio WhatsApp:{' '}
                        {new Date(integration.lastSentAt).toLocaleString('pt-BR')}
                      </div>
                    )}
                    {integration.lastSyncStatus && (
                      <div>
                        Status: <span className="text-text">{integration.lastSyncStatus}</span>
                      </div>
                    )}
                    {integration.lastSyncError && (
                      <div className="text-danger">Erro recente: {integration.lastSyncError}</div>
                    )}
                  </div>
                )}

              <div className="mt-5 flex flex-wrap gap-2">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(integration.id)}
                    disabled={disconnectBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/20 disabled:opacity-50"
                  >
                    {disconnectBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unplug className="h-4 w-4" />
                    )}
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => handleConnect(integration.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Conectando…
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        {integration.id === 'whatsapp' || integration.id === 'email'
                          ? 'Configurar e conectar'
                          : 'Conectar'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {setupModalIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-text">
              {setupModalIntegration === 'whatsapp'
                ? 'Configuração guiada do WhatsApp'
                : 'Configuração guiada de e-mail'}
            </h2>
            <p className="mt-2 text-sm text-mute">
              {setupModalIntegration === 'whatsapp'
                ? 'Defina número de destino e, opcionalmente, webhook para entrega personalizada.'
                : 'Defina o e-mail de destino para teste e envio de notificações.'}
            </p>

            {setupModalIntegration === 'whatsapp' ? (
              <div className="mt-4 space-y-3">
                <input
                  value={setupForm.phoneNumber}
                  onChange={(event) =>
                    setSetupForm((prev) => ({ ...prev, phoneNumber: event.target.value }))
                  }
                  placeholder="+55 11 99999-9999"
                  className="w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
                />
                <input
                  value={setupForm.webhookUrl}
                  onChange={(event) =>
                    setSetupForm((prev) => ({ ...prev, webhookUrl: event.target.value }))
                  }
                  placeholder="https://seu-webhook.exemplo.com (opcional)"
                  className="w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
                />
              </div>
            ) : (
              <div className="mt-4">
                <input
                  value={setupForm.emailAddress}
                  onChange={(event) =>
                    setSetupForm((prev) => ({ ...prev, emailAddress: event.target.value }))
                  }
                  placeholder="seu-email@empresa.com"
                  className="w-full rounded-[14px] border border-border bg-bg/70 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSetupModalIntegration(null)}
                className="rounded-full border border-border px-4 py-2 text-sm text-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitGuidedSetup}
                disabled={busyKey === `connect:${setupModalIntegration}`}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-50"
              >
                {busyKey === `connect:${setupModalIntegration}` && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Conectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
