import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { StudioPanel, StudioPill, StudioScreen } from '../src/components/StudioScreen';
import { authedApiFetch, getApiBaseUrl } from '../src/lib/api-client';

type IntegrationId = 'google-drive' | 'google-calendar' | 'onedrive' | 'dropbox' | 'whatsapp';

type Integration = {
  id: IntegrationId;
  name: string;
  description: string;
  status: 'disconnected' | 'connected' | 'connecting';
  connectedAt?: string | null;
  connectedEmail?: string | null;
  targetFolder?: string | null;
  phoneNumber?: string | null;
  webhookUrl?: string;
  receiveUrl?: string | null;
  receiveToken?: string | null;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  lastSentAt?: string | null;
};

const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Backup real de áudio, JSON e Markdown em pasta dedicada.',
    status: 'disconnected',
    targetFolder: '/Gravador',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Conexão OAuth preparada para fluxos de agenda.',
    status: 'disconnected',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Backup automático em pasta configurável do OneDrive.',
    status: 'disconnected',
    targetFolder: '/Apps/Gravador',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Envio de pacotes completos da gravação para Dropbox.',
    status: 'disconnected',
    targetFolder: '/Apps/Gravador',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Envio oficial via WhatsApp Cloud API com webhook opcional para automações.',
    status: 'disconnected',
    webhookUrl: '',
  },
];

export default function IntegrationsScreen() {
  const router = useRouter();
  const [integrations, setIntegrations] = React.useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [loading, setLoading] = React.useState(true);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const storageIntegrations = React.useMemo(
    () => new Set<IntegrationId>(['google-drive', 'onedrive', 'dropbox']),
    [],
  );

  const patchIntegration = (integrationId: IntegrationId, patch: Partial<Integration>) => {
    setIntegrations((current) =>
      current.map((integration) =>
        integration.id === integrationId ? { ...integration, ...patch } : integration,
      ),
    );
  };

  const loadIntegrations = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedApiFetch('/api/integrations');
      const data = (await res.json()) as { integrations?: Array<Partial<Integration>> };
      if (!res.ok || !Array.isArray(data.integrations)) {
        throw new Error('Não foi possível carregar integrações.');
      }

      setIntegrations((current) =>
        current.map((integration) => {
          const remote = data.integrations?.find((item) => item.id === integration.id);
          if (!remote) return integration;
          return {
            ...integration,
            ...remote,
            status: remote.status === 'connected' ? 'connected' : 'disconnected',
          };
        }),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao carregar integrações.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadIntegrations().catch(() => undefined);
  }, [loadIntegrations]);

  const openWebIntegrations = async () => {
    await Linking.openURL(`${getApiBaseUrl()}/workspace/integrations`);
  };

  const handleConnect = async (integration: Integration) => {
    setBusyKey(`connect:${integration.id}`);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = { integrationId: integration.id };
      if (integration.id === 'whatsapp') {
        if (!integration.phoneNumber?.trim()) {
          throw new Error('Informe o número de destino do WhatsApp antes de conectar.');
        }

        payload.phoneNumber = integration.phoneNumber.trim();
        if (integration.webhookUrl?.trim()) {
          payload.webhookUrl = integration.webhookUrl.trim();
        }
      }

      const res = await authedApiFetch('/api/integrations/connect', {
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
        throw new Error(data?.message ?? `Falha ao conectar (${res.status}).`);
      }

      if (data?.redirectUrl) {
        await Linking.openURL(data.redirectUrl);
        setNotice('Conclua o OAuth no navegador e depois toque em Atualizar status.');
        return;
      }

      patchIntegration(integration.id, {
        status: 'connected',
        connectedAt: new Date().toISOString(),
        receiveUrl: data?.receiveUrl,
        receiveToken: data?.inboundToken,
      });
      setNotice(`${integration.name} conectado com sucesso.`);
    } catch (error) {
      patchIntegration(integration.id, { status: 'disconnected' });
      setNotice(error instanceof Error ? error.message : 'Erro ao conectar integração.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    setBusyKey(`disconnect:${integration.id}`);
    setNotice(null);
    try {
      const res = await authedApiFetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id }),
      });
      if (!res.ok) {
        throw new Error(`Falha ao desconectar (${res.status}).`);
      }
      patchIntegration(integration.id, {
        status: 'disconnected',
        connectedAt: null,
        connectedEmail: null,
        receiveUrl: null,
        receiveToken: null,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        lastSentAt: null,
      });
      setNotice(`${integration.name} desconectado.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Erro ao desconectar integração.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveSettings = async (integration: Integration) => {
    setBusyKey(`save:${integration.id}`);
    setNotice(null);
    try {
      const res = await authedApiFetch('/api/integrations/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: integration.id,
          targetFolder: integration.targetFolder,
          phoneNumber: integration.phoneNumber,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Falha ao salvar (${res.status}).`);
      }
      setNotice('Configuração salva com sucesso.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Erro ao salvar configuração.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSync = async (integration: Integration) => {
    setBusyKey(`sync:${integration.id}`);
    setNotice(null);
    try {
      const res = await authedApiFetch('/api/integrations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id, limit: 1 }),
      });
      const data = (await res.json().catch(() => null)) as {
        status?: string;
        failures?: Array<{ message?: string }>;
      } | null;
      if (!res.ok) {
        throw new Error(data?.failures?.[0]?.message ?? `Falha ao sincronizar (${res.status}).`);
      }

      patchIntegration(integration.id, {
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: data?.status === 'partial' ? 'partial' : 'ok',
        lastSyncError: data?.status === 'partial' ? (data.failures?.[0]?.message ?? null) : null,
        ...(integration.id === 'whatsapp' ? { lastSentAt: new Date().toISOString() } : {}),
      });

      setNotice(
        integration.id === 'whatsapp'
          ? 'Sincronização do WhatsApp concluída.'
          : 'Backup sincronizado com sucesso.',
      );
    } catch (error) {
      patchIntegration(integration.id, {
        lastSyncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : 'Erro na sincronização.',
      });
      setNotice(error instanceof Error ? error.message : 'Erro ao sincronizar integração.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <StudioScreen scroll className="pb-6 pt-2">
      <View className="gap-5 pb-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-mute">← voltar</Text>
        </Pressable>

        <View>
          <StudioPill label="Integrations" tone="accent" />
          <Text className="mt-5 text-xs uppercase tracking-[0.28em] text-mute">Connectors</Text>
          <Text className="mt-3 text-4xl font-semibold text-text">Integrações</Text>
          <Text className="mt-3 leading-7 text-mute">
            Aqui no mobile você consegue monitorar status, sincronizar backups e ajustar os
            parâmetros operacionais das integrações reais.
          </Text>
        </View>

        {notice ? (
          <StudioPanel>
            <Text className="text-sm leading-6 text-text">{notice}</Text>
          </StudioPanel>
        ) : null}

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Atalhos</Text>
          <View className="mt-4 gap-3">
            <Pressable
              onPress={openWebIntegrations}
              className="rounded-[22px] border border-border bg-surfaceAlt px-4 py-4"
            >
              <Text className="font-semibold text-text">Abrir painel web de integrações</Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                Use este atalho para concluir autorizações OAuth no navegador quando necessário.
              </Text>
            </Pressable>
            <Pressable
              onPress={() => loadIntegrations()}
              className="rounded-[22px] border border-border bg-surfaceAlt px-4 py-4"
            >
              <Text className="font-semibold text-text">Atualizar status das conexões</Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                Recarrega estados, últimas sincronizações e tokens de recebimento.
              </Text>
            </Pressable>
          </View>
        </StudioPanel>

        {loading ? (
          <StudioPanel>
            <Text className="text-sm text-mute">Carregando integrações...</Text>
          </StudioPanel>
        ) : (
          integrations.map((integration) => {
            const isConnected = integration.status === 'connected';
            const isConnecting = busyKey === `connect:${integration.id}`;
            const isSaving = busyKey === `save:${integration.id}`;
            const isSyncing = busyKey === `sync:${integration.id}`;
            const isDisconnecting = busyKey === `disconnect:${integration.id}`;
            const isStorage = storageIntegrations.has(integration.id);

            return (
              <StudioPanel key={integration.id}>
                <Text className="text-xs uppercase tracking-[0.24em] text-mute">
                  {integration.id}
                </Text>
                <Text className="mt-3 text-2xl font-semibold text-text">{integration.name}</Text>
                <Text className="mt-2 text-sm leading-6 text-mute">{integration.description}</Text>

                <View className="mt-4 rounded-[20px] border border-border bg-surfaceAlt px-4 py-3">
                  <Text className="text-sm font-semibold text-text">
                    Status: {isConnected ? 'Conectado' : 'Desconectado'}
                  </Text>
                  {integration.connectedEmail ? (
                    <Text className="mt-1 text-sm text-mute">
                      Conta: {integration.connectedEmail}
                    </Text>
                  ) : null}
                  {integration.connectedAt ? (
                    <Text className="mt-1 text-sm text-mute">
                      Conectado em: {new Date(integration.connectedAt).toLocaleString('pt-BR')}
                    </Text>
                  ) : null}
                  {integration.lastSyncedAt ? (
                    <Text className="mt-1 text-sm text-mute">
                      Última sincronização:{' '}
                      {new Date(integration.lastSyncedAt).toLocaleString('pt-BR')}
                    </Text>
                  ) : null}
                  {integration.lastSyncError ? (
                    <Text className="mt-2 text-sm text-danger">
                      Erro: {integration.lastSyncError}
                    </Text>
                  ) : null}
                </View>

                {integration.id === 'whatsapp' && (
                  <View className="mt-4 gap-3">
                    <TextInput
                      value={integration.webhookUrl ?? ''}
                      onChangeText={(value) =>
                        patchIntegration(integration.id, { webhookUrl: value })
                      }
                      placeholder="Webhook opcional (https://...)"
                      placeholderTextColor="#8f7f73"
                      autoCapitalize="none"
                      className="rounded-[16px] border border-border bg-surfaceAlt px-4 py-3 text-text"
                    />
                    <TextInput
                      value={integration.phoneNumber ?? ''}
                      onChangeText={(value) =>
                        patchIntegration(integration.id, { phoneNumber: value })
                      }
                      placeholder="Número de destino (+55...)"
                      placeholderTextColor="#8f7f73"
                      className="rounded-[16px] border border-border bg-surfaceAlt px-4 py-3 text-text"
                    />
                    {integration.receiveUrl ? (
                      <Text className="text-xs text-mute">
                        Endpoint de entrada: {integration.receiveUrl}
                      </Text>
                    ) : null}
                    {integration.receiveToken ? (
                      <Text className="text-xs text-mute">
                        Token de entrada: {integration.receiveToken}
                      </Text>
                    ) : null}
                  </View>
                )}

                {isConnected && isStorage && (
                  <View className="mt-4 gap-3">
                    <TextInput
                      value={integration.targetFolder ?? ''}
                      onChangeText={(value) =>
                        patchIntegration(integration.id, { targetFolder: value })
                      }
                      placeholder="Pasta de backup"
                      placeholderTextColor="#8f7f73"
                      autoCapitalize="none"
                      className="rounded-[16px] border border-border bg-surfaceAlt px-4 py-3 text-text"
                    />
                  </View>
                )}

                <View className="mt-4 gap-3">
                  {!isConnected ? (
                    <Pressable
                      disabled={isConnecting}
                      onPress={() => handleConnect(integration)}
                      className="rounded-[22px] bg-accent px-4 py-4 disabled:opacity-60"
                    >
                      <Text className="text-center font-semibold text-[#120d0a]">
                        {isConnecting ? 'Conectando...' : 'Conectar'}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        disabled={isSaving}
                        onPress={() => handleSaveSettings(integration)}
                        className="rounded-[22px] border border-border bg-surfaceAlt px-4 py-4 disabled:opacity-60"
                      >
                        <Text className="text-center font-semibold text-text">
                          {isSaving ? 'Salvando...' : 'Salvar configuração'}
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={isSyncing}
                        onPress={() => handleSync(integration)}
                        className="rounded-[22px] bg-accent px-4 py-4 disabled:opacity-60"
                      >
                        <Text className="text-center font-semibold text-[#120d0a]">
                          {isSyncing
                            ? 'Sincronizando...'
                            : integration.id === 'whatsapp'
                              ? 'Sincronizar WhatsApp'
                              : 'Sincronizar backups'}
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={isDisconnecting}
                        onPress={() => handleDisconnect(integration)}
                        className="rounded-[22px] border border-danger/60 bg-danger/10 px-4 py-4 disabled:opacity-60"
                      >
                        <Text className="text-center font-semibold text-danger">
                          {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </StudioPanel>
            );
          })
        )}
      </View>
    </StudioScreen>
  );
}
