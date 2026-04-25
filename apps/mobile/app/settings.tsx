import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { StudioPanel, StudioPill, StudioScreen } from '../src/components/StudioScreen';
import { useAuthSession } from '../src/features/auth/session';
import { authedApiFetch } from '../src/lib/api-client';
import { auth } from '../src/lib/firebase';
import { useI18n } from '../src/lib/i18n';

type TranscribeProvider = 'groq' | 'openai' | 'elevenlabs' | 'local-faster-whisper';

const PROVIDER_DETAILS: Array<{
  id: TranscribeProvider;
  title: string;
  behavior: string;
  costs: string;
}> = [
  {
    id: 'groq',
    title: 'Groq (Whisper v3)',
    behavior: 'Mais rápido para backlog alto. Boa latência com qualidade estável.',
    costs: 'Cobrança BYOK na conta Groq. Referência: ~US$0.111/hora.',
  },
  {
    id: 'openai',
    title: 'OpenAI (Whisper)',
    behavior: 'Referência de qualidade consistente em múltiplos idiomas.',
    costs: 'Cobrança BYOK na conta OpenAI. Referência: ~US$0.006/minuto.',
  },
  {
    id: 'elevenlabs',
    title: 'ElevenLabs (Scribe)',
    behavior: 'Modelo multilíngue com timestamps detalhados e suporte a diarização.',
    costs: 'Cobrança BYOK na conta ElevenLabs. Consulte a tabela vigente no painel.',
  },
  {
    id: 'local-faster-whisper',
    title: 'Local (faster-whisper)',
    behavior: 'Processa no seu servidor, sem envio para terceiros.',
    costs: 'Sem custo por token. Custo é a sua infraestrutura (CPU/GPU).',
  },
];

const PROVIDER_MODELS: Record<
  TranscribeProvider,
  Array<{ id: string; title: string; note: string }>
> = {
  groq: [
    {
      id: 'whisper-large-v3',
      title: 'whisper-large-v3',
      note: 'Maior precisao',
    },
    {
      id: 'whisper-large-v3-turbo',
      title: 'whisper-large-v3-turbo',
      note: 'Mais rapido',
    },
  ],
  openai: [
    {
      id: 'whisper-1',
      title: 'whisper-1',
      note: 'Padrao estavel',
    },
  ],
  elevenlabs: [
    {
      id: 'scribe_v2',
      title: 'scribe_v2',
      note: 'Mais recente, com diarizacao e timestamps detalhados',
    },
    {
      id: 'scribe_v1',
      title: 'scribe_v1',
      note: 'Versao legada com boa compatibilidade',
    },
  ],
  'local-faster-whisper': [
    {
      id: 'faster-whisper-large-v3',
      title: 'faster-whisper-large-v3',
      note: 'Maior precisao',
    },
    {
      id: 'faster-whisper-medium',
      title: 'faster-whisper-medium',
      note: 'Equilibrio',
    },
    {
      id: 'faster-whisper-small',
      title: 'faster-whisper-small',
      note: 'Mais leve',
    },
  ],
};

const TRANSCRIPTION_PROFILES: Array<{
  id: string;
  title: string;
  description: string;
  provider: TranscribeProvider;
  model: string;
}> = [
  {
    id: 'speed',
    title: '⚡ Velocidade',
    description: 'Groq Turbo para menor latência e menor custo por hora.',
    provider: 'groq',
    model: 'whisper-large-v3-turbo',
  },
  {
    id: 'quality',
    title: '🎯 Qualidade',
    description: 'OpenAI Whisper-1 para baseline estável de precisão.',
    provider: 'openai',
    model: 'whisper-1',
  },
  {
    id: 'multilingual',
    title: '🌍 Multilíngue',
    description: 'ElevenLabs Scribe v2 para diarização e timestamps por palavra.',
    provider: 'elevenlabs',
    model: 'scribe_v2',
  },
  {
    id: 'privacy',
    title: '🔒 Privacidade',
    description: 'faster-whisper local para não enviar áudio a terceiros.',
    provider: 'local-faster-whisper',
    model: 'faster-whisper-large-v3',
  },
];

function defaultModelFor(provider: TranscribeProvider) {
  if (provider === 'openai') return 'whisper-1';
  if (provider === 'elevenlabs') return 'scribe_v2';
  if (provider === 'local-faster-whisper') return 'faster-whisper-large-v3';
  return 'whisper-large-v3';
}

function normalizeProvider(input: unknown): TranscribeProvider {
  if (input === 'openai') return 'openai';
  if (input === 'elevenlabs') return 'elevenlabs';
  if (input === 'local' || input === 'local-faster-whisper') return 'local-faster-whisper';
  return 'groq';
}

export default function SettingsScreen() {
  const router = useRouter();
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const user = useAuthSession((state) => state.user);
  const [signingOut, setSigningOut] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<Record<string, unknown>>({});
  const [transcribeProvider, setTranscribeProvider] = useState<TranscribeProvider>('groq');
  const [transcribeModel, setTranscribeModel] = useState(defaultModelFor('groq'));
  const trimmedTranscribeModel = transcribeModel.trim();
  const byokKeysRaw =
    aiSettings.byokKeys && typeof aiSettings.byokKeys === 'object'
      ? (aiSettings.byokKeys as Record<string, unknown>)
      : {};
  const hasGroqKey = typeof byokKeysRaw.groq === 'string' && byokKeysRaw.groq.trim().length > 0;
  const hasOpenAIKey =
    typeof byokKeysRaw.openai === 'string' && byokKeysRaw.openai.trim().length > 0;
  const hasElevenLabsKey =
    typeof byokKeysRaw.elevenlabs === 'string' && byokKeysRaw.elevenlabs.trim().length > 0;
  const providerNeedsKey =
    transcribeProvider === 'groq' ||
    transcribeProvider === 'openai' ||
    transcribeProvider === 'elevenlabs';
  const providerLabel =
    transcribeProvider === 'groq'
      ? 'Groq'
      : transcribeProvider === 'openai'
        ? 'OpenAI'
        : transcribeProvider === 'elevenlabs'
          ? 'ElevenLabs'
          : 'faster-whisper local';
  const providerKeyConfigured =
    transcribeProvider === 'groq'
      ? hasGroqKey
      : transcribeProvider === 'openai'
        ? hasOpenAIKey
        : transcribeProvider === 'elevenlabs'
          ? hasElevenLabsKey
          : true;
  const readinessItems: Array<{ label: string; done: boolean }> = [
    { label: 'Provedor selecionado', done: true },
    { label: 'Modelo preenchido', done: trimmedTranscribeModel.length > 0 },
    {
      label: providerNeedsKey
        ? `API key de ${providerLabel} configurada`
        : 'Modo local selecionado (validar endpoint)',
      done: providerKeyConfigured,
    },
  ];
  const readinessDone = readinessItems.filter((item) => item.done).length;
  const transcriptionReady = readinessDone === readinessItems.length;

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setSettingsLoading(true);
      try {
        const res = await authedApiFetch('/api/settings');
        const data = (await res.json().catch(() => null)) as {
          aiSettings?: Record<string, unknown>;
          error?: string;
        } | null;

        if (!res.ok) {
          throw new Error(data?.error ?? `Falha ao carregar settings (${res.status}).`);
        }

        const nextAi = data?.aiSettings ?? {};
        if (!active) return;

        const provider = normalizeProvider(nextAi.transcribeProvider);
        const modelFromSettings =
          typeof nextAi.transcribeModel === 'string' ? nextAi.transcribeModel.trim() : '';

        setAiSettings(nextAi);
        setTranscribeProvider(provider);
        setTranscribeModel(modelFromSettings || defaultModelFor(provider));
      } catch (error) {
        if (!active) return;
        setSettingsNotice(
          error instanceof Error ? error.message : 'Não foi possível carregar os settings de IA.',
        );
      } finally {
        if (active) setSettingsLoading(false);
      }
    };

    loadSettings().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const saveTranscriptionSettings = async () => {
    const normalizedModel = trimmedTranscribeModel || defaultModelFor(transcribeProvider);
    if (!normalizedModel) {
      setSettingsNotice('Informe um modelo antes de salvar a configuração de transcrição.');
      return;
    }

    setSavingAI(true);
    setSettingsNotice(null);
    try {
      const nextAiSettings: Record<string, unknown> = {
        ...aiSettings,
        transcribeProvider,
        transcribeModel: normalizedModel,
      };

      const res = await authedApiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiSettings: nextAiSettings }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? `Falha ao salvar settings (${res.status}).`);
      }

      setAiSettings(nextAiSettings);
      setSettingsNotice(
        providerNeedsKey && !providerKeyConfigured
          ? `Configuração salva. Falta API key de ${providerLabel} no web para evitar falha na execução.`
          : 'Configuração de transcrição atualizada com sucesso.',
      );
    } catch (error) {
      setSettingsNotice(
        error instanceof Error ? error.message : 'Erro ao salvar configuração de transcrição.',
      );
    } finally {
      setSavingAI(false);
    }
  };

  return (
    <StudioScreen scroll className="pb-6 pt-2">
      <View className="gap-5 pb-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-mute">← voltar</Text>
        </Pressable>

        <View>
          <StudioPill label="Control room" tone="neutral" />
          <Text className="mt-5 text-xs uppercase tracking-[0.28em] text-mute">Preferences</Text>
          <Text className="mt-3 text-4xl font-semibold text-text">Configurações</Text>
          <Text className="mt-3 leading-7 text-mute">
            O app agora precisa sustentar uma sensação de ferramenta premium também nas áreas
            calmas: conta, idioma e sessão.
          </Text>
        </View>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Google</Text>
          <Text className="mt-4 text-3xl font-semibold text-text">{user?.email ?? '-'}</Text>
          <Text className="mt-3 text-sm leading-6 text-mute">{user?.uid ?? '-'}</Text>
          <View className="mt-5 rounded-[24px] border border-border bg-surfaceAlt px-4 py-4">
            <Text className="font-medium text-text">
              Sessão conectada ao mesmo backend do workspace web.
            </Text>
            <Text className="mt-2 text-sm leading-6 text-mute">
              Isso mantém gravações, uploads e contexto de autenticação na mesma trilha de produto.
            </Text>
          </View>
        </StudioPanel>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Idioma</Text>
          <View className="mt-5 flex-row gap-3">
            {(['pt-BR', 'en'] as const).map((language) => (
              <Pressable
                key={language}
                onPress={() => setLocale(language)}
                className={`flex-1 rounded-[22px] border px-4 py-4 ${
                  locale === language ? 'border-accent bg-accent' : 'border-border bg-surfaceAlt'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${locale === language ? 'text-[#120d0a]' : 'text-text'}`}
                >
                  {language}
                </Text>
              </Pressable>
            ))}
          </View>
        </StudioPanel>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Release path</Text>
          <View className="mt-4 gap-3">
            <View className="rounded-[24px] border border-border bg-surfaceAlt px-4 py-4">
              <Text className="font-medium text-text">Web vivo, mobile em refinamento.</Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                A linguagem visual agora está sendo puxada para o mesmo nível do web antes do APK
                final.
              </Text>
            </View>
            <View className="rounded-[24px] border border-border bg-surfaceAlt px-4 py-4">
              <Text className="font-medium text-text">Próximo gargalo: Expo/EAS auth.</Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                Assim que autenticar, a trilha do preview Android volta a andar.
              </Text>
            </View>
          </View>
        </StudioPanel>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">
            Transcrição (agente)
          </Text>
          <Text className="mt-4 text-2xl font-semibold text-text">Provedor e custos no mobile</Text>
          <Text className="mt-2 text-sm leading-6 text-mute">
            Escolha como o agente de transcrição deve operar. Os custos variam por provedor e são
            cobrados na sua conta BYOK quando aplicável.
          </Text>

          <View className="mt-4 rounded-[20px] border border-border bg-surfaceAlt px-4 py-4">
            <Text className="font-medium text-text">Ativação sem erro</Text>
            <Text className="mt-2 text-sm leading-6 text-mute">
              Para Groq/OpenAI/ElevenLabs, configure a API key BYOK no web em Configurações {'>'}{' '}
              Provedores de IA ou Agentes. Para modo local, mantenha o serviço faster-whisper ativo
              no endpoint da infraestrutura.
            </Text>
          </View>

          <View
            className={`mt-4 rounded-[20px] border px-4 py-4 ${
              transcriptionReady ? 'border-ok/40 bg-ok/10' : 'border-warning/40 bg-warning/10'
            }`}
          >
            <Text className={`font-medium ${transcriptionReady ? 'text-ok' : 'text-warning'}`}>
              Prontidão de transcrição: {readinessDone}/{readinessItems.length}
            </Text>
            <View className="mt-2 gap-1">
              {readinessItems.map((item) => (
                <Text
                  key={item.label}
                  className={`text-xs leading-5 ${item.done ? 'text-text' : 'text-mute'}`}
                >
                  {item.done ? '✓' : '•'} {item.label}
                </Text>
              ))}
            </View>
            <Text className="mt-2 text-xs leading-5 text-mute">
              {trimmedTranscribeModel.length === 0
                ? 'Preencha o modelo para evitar fallback inesperado.'
                : providerNeedsKey && !providerKeyConfigured
                  ? `Falta API key de ${providerLabel} no workspace web.`
                  : transcribeProvider === 'local-faster-whisper'
                    ? 'Valide o serviço local no endpoint LOCAL_WHISPER_URL.'
                    : 'Setup pronto para rodar transcrição em produção.'}
            </Text>
          </View>

          <View className="mt-4 gap-2">
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Perfis rápidos</Text>
            {TRANSCRIPTION_PROFILES.map((profile) => {
              const active =
                transcribeProvider === profile.provider && trimmedTranscribeModel === profile.model;
              return (
                <Pressable
                  key={profile.id}
                  onPress={() => {
                    setTranscribeProvider(profile.provider);
                    setTranscribeModel(profile.model);
                    setSettingsNotice(null);
                  }}
                  className={`rounded-[18px] border px-4 py-3 ${
                    active ? 'border-accent bg-accent/15' : 'border-border bg-surfaceAlt'
                  }`}
                >
                  <Text className="font-semibold text-text">{profile.title}</Text>
                  <Text className="mt-1 text-xs leading-5 text-mute">{profile.description}</Text>
                  {active ? <Text className="mt-2 text-xs text-accent">Perfil ativo ✓</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <View className="mt-4 gap-3">
            {PROVIDER_DETAILS.map((provider) => {
              const selected = transcribeProvider === provider.id;
              return (
                <Pressable
                  key={provider.id}
                  onPress={() => {
                    setTranscribeProvider(provider.id);
                    setTranscribeModel(defaultModelFor(provider.id));
                  }}
                  className={`rounded-[22px] border px-4 py-4 ${
                    selected ? 'border-accent bg-accent/15' : 'border-border bg-surfaceAlt'
                  }`}
                >
                  <Text className="font-semibold text-text">{provider.title}</Text>
                  <Text className="mt-2 text-sm leading-6 text-mute">{provider.behavior}</Text>
                  <Text className="mt-2 text-sm leading-6 text-mute">{provider.costs}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-4 gap-3">
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Modelo</Text>
            <View className="gap-2">
              {PROVIDER_MODELS[transcribeProvider].map((model) => {
                const selected = transcribeModel.trim() === model.id;
                return (
                  <Pressable
                    key={model.id}
                    onPress={() => setTranscribeModel(model.id)}
                    className={`rounded-[16px] border px-4 py-3 ${
                      selected ? 'border-accent bg-accent/15' : 'border-border bg-surfaceAlt'
                    }`}
                  >
                    <Text className="font-semibold text-text">{model.title}</Text>
                    <Text className="mt-1 text-xs leading-5 text-mute">{model.note}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={transcribeModel}
              onChangeText={setTranscribeModel}
              placeholder={defaultModelFor(transcribeProvider)}
              placeholderTextColor="#8f7f73"
              autoCapitalize="none"
              className="rounded-[16px] border border-border bg-surfaceAlt px-4 py-3 text-text"
            />
            <Text className="text-xs leading-5 text-mute">
              Aceita modelo personalizado: use o ID exato suportado pelo provedor selecionado.
            </Text>
          </View>

          <Pressable
            onPress={saveTranscriptionSettings}
            disabled={savingAI || settingsLoading || trimmedTranscribeModel.length === 0}
            className="mt-4 rounded-[22px] bg-accent px-4 py-4 disabled:opacity-60"
          >
            <Text className="text-center font-semibold text-[#120d0a]">
              {settingsLoading ? 'Carregando...' : savingAI ? 'Salvando...' : 'Salvar transcrição'}
            </Text>
          </Pressable>

          {settingsNotice ? (
            <View className="mt-4 rounded-[18px] border border-border bg-surfaceAlt px-4 py-3">
              <Text className="text-sm leading-6 text-text">{settingsNotice}</Text>
            </View>
          ) : null}
        </StudioPanel>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Integrações</Text>
          <Text className="mt-3 text-2xl font-semibold text-text">Gerenciar conectores</Text>
          <Text className="mt-2 text-sm leading-6 text-mute">
            Faça sync de backups, ajuste pasta de destino e controle o webhook do WhatsApp direto
            pelo app.
          </Text>
          <Pressable
            onPress={() => router.push('/integrations')}
            className="mt-4 rounded-[22px] border border-border bg-surfaceAlt px-4 py-4"
          >
            <Text className="text-center font-semibold text-text">Abrir integrações no mobile</Text>
          </Pressable>
        </StudioPanel>

        <Pressable
          onPress={async () => {
            setSigningOut(true);
            try {
              await signOut(auth);
              router.replace('/auth');
            } finally {
              setSigningOut(false);
            }
          }}
          disabled={signingOut}
          className="rounded-[28px] border border-danger/50 bg-danger/10 px-5 py-5"
        >
          <Text className="text-center font-semibold text-danger">
            {signingOut ? 'Saindo...' : 'Sair'}
          </Text>
        </Pressable>
      </View>
    </StudioScreen>
  );
}
