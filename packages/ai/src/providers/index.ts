import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIProvider } from '@gravador/core';
import type { LanguageModel } from 'ai';
import { createOllama } from 'ollama-ai-provider';

export type ChatModelName =
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-7'
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'llama3.1:70b'
  | 'llama3.1:8b'
  | (string & {});

export type GenerationProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'groq'
  | 'ollama'
  | 'openrouter';

export interface ProviderKeys {
  openai?: string;
  anthropic?: string;
  groq?: string;
  google?: string;
  openrouter?: string;
  ollamaBaseUrl?: string;
}

export interface ChatModelCandidate {
  provider: GenerationProvider;
  model: ChatModelName;
}

const OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  'gpt-4.1': 'openai/gpt-4.1',
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'claude-sonnet-4-6': 'anthropic/claude-sonnet-4-6',
  'claude-opus-4-7': 'anthropic/claude-opus-4',
  'gemini-2.5-pro': 'google/gemini-2.5-pro-preview',
  'gemini-2.5-flash': 'google/gemini-2.5-flash-preview',
};

const FALLBACK_PROVIDER_ORDER: GenerationProvider[] = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'groq',
  'ollama',
];

export function getDefaultChatModel(provider: GenerationProvider): ChatModelName {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-6';
    case 'openai':
      return 'gpt-4o-mini';
    case 'google':
      return 'gemini-2.5-flash';
    case 'groq':
      return 'llama3-groq-70b-tool-use';
    case 'openrouter':
      return 'openai/gpt-4o-mini';
    case 'ollama':
      return 'llama3.1:8b';
  }
}

export function normalizeChatModel(
  provider: GenerationProvider,
  model: string | undefined,
): ChatModelName {
  const trimmed = (model ?? '').trim();
  if (!trimmed) return getDefaultChatModel(provider);
  if (provider === 'openrouter') {
    return (OPENROUTER_MODEL_ALIASES[trimmed] ?? trimmed) as ChatModelName;
  }
  return trimmed as ChatModelName;
}

export function hasConfiguredProviderKey(
  provider: GenerationProvider,
  keys: ProviderKeys = {},
): boolean {
  switch (provider) {
    case 'anthropic':
      return Boolean(keys.anthropic ?? process.env.ANTHROPIC_API_KEY);
    case 'openai':
      return Boolean(keys.openai ?? process.env.OPENAI_API_KEY);
    case 'google':
      return Boolean(keys.google ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    case 'groq':
      return Boolean(keys.groq ?? process.env.GROQ_API_KEY);
    case 'openrouter':
      return Boolean(keys.openrouter ?? process.env.OPENROUTER_API_KEY);
    case 'ollama':
      return true;
  }
}

export function buildChatModelCandidates(
  preferred: { provider?: GenerationProvider; model?: string },
  keys: ProviderKeys = {},
): ChatModelCandidate[] {
  const primaryProvider = preferred.provider ?? 'anthropic';
  const candidates: ChatModelCandidate[] = [];
  const seen = new Set<string>();

  const add = (provider: GenerationProvider, model: string | undefined) => {
    if (!hasConfiguredProviderKey(provider, keys)) return;
    const normalizedModel = normalizeChatModel(provider, model);
    const key = `${provider}:${normalizedModel}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ provider, model: normalizedModel });
  };

  add(primaryProvider, preferred.model);
  add(primaryProvider, undefined);

  for (const provider of FALLBACK_PROVIDER_ORDER) {
    add(provider, undefined);
  }

  return candidates;
}

export function isRecoverableModelRoutingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return [
    'missing openai_api_key',
    'missing anthropic_api_key',
    'missing google_generative_ai_api_key',
    'missing groq_api_key',
    'missing openrouter_api_key',
    'does not exist',
    'do not have access',
    'model not found',
    'unknown model',
    'no endpoints found that support tool use',
    'does not support tool',
    'unsupported response_format',
    'json_schema',
    'disable "json"',
    'structured output',
  ].some((token) => normalized.includes(token));
}

function normalizeOllamaBaseUrl(raw: string | undefined): string {
  const fallback = 'http://127.0.0.1:11434';
  const value = (raw ?? '').trim();
  if (!value) return fallback;
  const withoutSlash = value.replace(/\/+$/, '');
  return withoutSlash.endsWith('/api') ? withoutSlash.slice(0, -4) : withoutSlash;
}

/**
 * Resolve a chat model across providers. Keys are layered:
 * workspace BYOK → env vars → fail.
 */
export function resolveChatModel(
  provider: AIProvider,
  model: ChatModelName,
  keys: ProviderKeys = {},
): LanguageModel {
  const normalizedModel = normalizeChatModel(provider as GenerationProvider, model);
  switch (provider) {
    case 'anthropic': {
      const apiKey = keys.anthropic ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
      return createAnthropic({ apiKey })(normalizedModel);
    }
    case 'openai': {
      const apiKey = keys.openai ?? process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
      return createOpenAI({ apiKey })(normalizedModel);
    }
    case 'google': {
      const apiKey = keys.google ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
      return createGoogleGenerativeAI({ apiKey })(normalizedModel);
    }
    case 'groq': {
      const apiKey = keys.groq ?? process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('Missing GROQ_API_KEY');
      return createGroq({ apiKey })(normalizedModel);
    }
    case 'openrouter': {
      const apiKey = keys.openrouter ?? process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');
      return createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      })(normalizedModel);
    }
    case 'ollama': {
      const baseRoot = normalizeOllamaBaseUrl(keys.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL);
      // Ollama provider ships its own @ai-sdk/provider copy; cast to unblock the version gap
      return createOllama({ baseURL: `${baseRoot}/api` })(
        normalizedModel,
      ) as unknown as LanguageModel;
    }
  }
}

export interface TranscribeOptions {
  audioUrl?: string;
  audioBytes?: ArrayBuffer;
  locale?: 'pt-BR' | 'en' | 'auto';
  provider?: 'groq' | 'openai' | 'elevenlabs' | 'local-faster-whisper';
  model?: string;
  keys?: {
    groq?: string;
    openai?: string;
    elevenlabs?: string;
    localBaseUrl?: string;
  };
  diarize?: boolean;
}

export interface TranscribeResult {
  provider: string;
  model: string;
  detectedLocale: 'pt-BR' | 'en' | null;
  fullText: string;
  segments: Array<{
    startMs: number;
    endMs: number;
    text: string;
    confidence: number | null;
    speakerId: string | null;
  }>;
}

type TranscribeProvider = NonNullable<TranscribeOptions['provider']>;

const TRANSCRIBE_FALLBACK_ORDER: TranscribeProvider[] = [
  'groq',
  'openai',
  'elevenlabs',
  'local-faster-whisper',
];

function resolveRequestedTranscribeProvider(opts: TranscribeOptions): TranscribeProvider {
  return (
    opts.provider ?? (process.env.AI_TRANSCRIBE_PROVIDER as TranscribeOptions['provider']) ?? 'groq'
  );
}

function hasConfiguredTranscribeProvider(
  provider: TranscribeProvider,
  opts: TranscribeOptions,
): boolean {
  switch (provider) {
    case 'groq':
      return Boolean(opts.keys?.groq ?? process.env.GROQ_API_KEY);
    case 'openai':
      return Boolean(opts.keys?.openai ?? process.env.OPENAI_API_KEY);
    case 'elevenlabs':
      return Boolean(opts.keys?.elevenlabs ?? process.env.ELEVENLABS_API_KEY);
    case 'local-faster-whisper':
      return Boolean(opts.keys?.localBaseUrl ?? process.env.LOCAL_WHISPER_URL);
  }
}

function buildTranscribeCandidates(
  preferredProvider: TranscribeProvider,
  opts: TranscribeOptions,
): TranscribeProvider[] {
  const candidates: TranscribeProvider[] = [preferredProvider];

  for (const provider of TRANSCRIBE_FALLBACK_ORDER) {
    if (provider === preferredProvider) continue;
    if (!hasConfiguredTranscribeProvider(provider, opts)) continue;
    candidates.push(provider);
  }

  return candidates;
}

function isRecoverableTranscribeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const normalized = message.toLowerCase();

  if (normalized.includes('audiourl or audiobytes required')) return false;
  if (normalized.includes('failed to download audio source')) return false;

  return true;
}

function getTranscribeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

function withTranscribeProvider(
  opts: TranscribeOptions,
  provider: TranscribeProvider,
  preserveModel: boolean,
): TranscribeOptions {
  return {
    ...opts,
    provider,
    model: preserveModel ? opts.model : undefined,
  };
}

async function runTranscribeProvider(
  provider: TranscribeProvider,
  opts: TranscribeOptions,
): Promise<TranscribeResult> {
  if (provider === 'groq') return transcribeGroq(opts);
  if (provider === 'openai') return transcribeOpenAI(opts);
  if (provider === 'elevenlabs') return transcribeElevenLabs(opts);
  return transcribeLocal(opts);
}

/**
 * Unified transcription entrypoint. Under the hood delegates to the selected
 * provider. Groq Whisper v3 is typically the lowest-latency cloud option,
 * ElevenLabs Scribe adds strong multilingual/word-level timestamp support,
 * and local `faster-whisper` is used in self-host mode.
 */
export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
  const preferredProvider = resolveRequestedTranscribeProvider(opts);
  const candidates = buildTranscribeCandidates(preferredProvider, opts);
  const failures: string[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const provider = candidates[index]!;
    const attemptOpts = withTranscribeProvider(opts, provider, provider === preferredProvider);
    try {
      return await runTranscribeProvider(provider, attemptOpts);
    } catch (error) {
      const message = getTranscribeErrorMessage(error);
      failures.push(`${provider}: ${message}`);
      const isLast = index === candidates.length - 1;
      if (isLast || !isRecoverableTranscribeError(error)) {
        throw new Error(`Transcription failed (${failures.join(' | ')})`);
      }
      console.warn(
        `[transcribe] provider ${provider} failed and fallback will be attempted: ${message}`,
      );
    }
  }

  throw new Error('Transcription failed: no providers available for attempt.');
}

async function loadAudioBlob(opts: TranscribeOptions): Promise<Blob> {
  if (opts.audioBytes) {
    return new Blob([opts.audioBytes]);
  }
  if (opts.audioUrl) {
    const res = await fetch(opts.audioUrl);
    if (!res.ok) {
      throw new Error(`Failed to download audio source: ${res.status}`);
    }
    return new Blob([await res.arrayBuffer()]);
  }
  throw new Error('audioUrl or audioBytes required');
}

function mapDetectedLocale(language: string | undefined): 'pt-BR' | 'en' | null {
  const normalized = (language ?? '').toLowerCase();
  if (normalized.startsWith('pt')) return 'pt-BR';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return null;
}

function resolveLanguageHint(locale: TranscribeOptions['locale']): string | undefined {
  if (!locale || locale === 'auto') return undefined;
  return locale === 'pt-BR' ? 'pt' : 'en';
}

interface ProviderSegment {
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
}

function mapProviderSegments(segments: ProviderSegment[] | undefined) {
  return (segments ?? []).map((s) => ({
    startMs: Math.round(s.start * 1000),
    endMs: Math.round(s.end * 1000),
    text: s.text.trim(),
    confidence: typeof s.avg_logprob === 'number' ? Math.exp(s.avg_logprob) : null,
    speakerId: null,
  }));
}

interface ElevenLabsWord {
  text?: string;
  start?: number;
  end?: number;
  speaker_id?: string | null;
  logprob?: number;
}

function mapElevenLabsWordsToSegments(
  words: ElevenLabsWord[] | undefined,
  fallbackText: string,
): TranscribeResult['segments'] {
  const tokens = Array.isArray(words) ? words : [];
  if (tokens.length === 0) {
    const text = fallbackText.trim();
    if (!text) return [];
    const estimatedEndMs = Math.max(1_000, Math.round(text.length * 60));
    return [
      {
        startMs: 0,
        endMs: estimatedEndMs,
        text,
        confidence: null,
        speakerId: null,
      },
    ];
  }

  const segments: TranscribeResult['segments'] = [];
  let current:
    | {
        startMs: number;
        endMs: number;
        speakerId: string | null;
        words: string[];
        confidences: number[];
      }
    | undefined;

  const flush = () => {
    if (!current) return;
    const text = current.words.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) {
      current = undefined;
      return;
    }
    const confidence =
      current.confidences.length > 0
        ? current.confidences.reduce((sum, value) => sum + value, 0) / current.confidences.length
        : null;
    segments.push({
      startMs: current.startMs,
      endMs: Math.max(current.endMs, current.startMs + 1),
      text,
      confidence,
      speakerId: current.speakerId,
    });
    current = undefined;
  };

  for (const token of tokens) {
    const text = (token.text ?? '').trim();
    if (!text) continue;

    const startMs =
      typeof token.start === 'number'
        ? Math.max(0, Math.round(token.start * 1000))
        : (current?.endMs ?? 0);
    const endMs =
      typeof token.end === 'number'
        ? Math.max(startMs + 1, Math.round(token.end * 1000))
        : startMs + Math.max(300, Math.round(text.length * 45));
    const speakerId = typeof token.speaker_id === 'string' ? token.speaker_id : null;
    const confidence = typeof token.logprob === 'number' ? Math.exp(token.logprob) : null;

    const shouldSplit =
      !current ||
      current.speakerId !== speakerId ||
      current.endMs - current.startMs > 12_000 ||
      /[.!?…]$/.test(current.words[current.words.length - 1] ?? '');

    if (shouldSplit) {
      flush();
      current = {
        startMs,
        endMs,
        speakerId,
        words: [text],
        confidences: confidence == null ? [] : [confidence],
      };
      continue;
    }

    if (!current) {
      current = {
        startMs,
        endMs,
        speakerId,
        words: [text],
        confidences: confidence == null ? [] : [confidence],
      };
      continue;
    }

    current.endMs = endMs;
    current.words.push(text);
    if (confidence != null) {
      current.confidences.push(confidence);
    }
  }

  flush();
  return segments;
}

async function transcribeGroq(opts: TranscribeOptions): Promise<TranscribeResult> {
  const apiKey = opts.keys?.groq ?? process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY for Groq transcription');
  const model = opts.model ?? process.env.AI_TRANSCRIBE_MODEL ?? 'whisper-large-v3';
  const form = new FormData();
  form.append('file', await loadAudioBlob(opts), 'audio.m4a');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  const languageHint = resolveLanguageHint(opts.locale);
  if (languageHint) {
    form.append('language', languageHint);
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq transcription failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    text: string;
    language?: string;
    segments?: Array<{ start: number; end: number; text: string; avg_logprob?: number }>;
  };

  return {
    provider: 'groq',
    model,
    detectedLocale: mapDetectedLocale(json.language),
    fullText: json.text,
    segments: mapProviderSegments(json.segments),
  };
}

async function transcribeOpenAI(opts: TranscribeOptions): Promise<TranscribeResult> {
  const apiKey = opts.keys?.openai ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const model = opts.model ?? process.env.AI_TRANSCRIBE_MODEL ?? 'whisper-1';
  const form = new FormData();
  form.append('file', await loadAudioBlob(opts), 'audio.m4a');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  const languageHint = resolveLanguageHint(opts.locale);
  if (languageHint) {
    form.append('language', languageHint);
  }

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI transcription failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    text: string;
    language?: string;
    segments?: Array<{ start: number; end: number; text: string; avg_logprob?: number }>;
  };

  return {
    provider: 'openai',
    model,
    detectedLocale: mapDetectedLocale(json.language),
    fullText: json.text,
    segments: mapProviderSegments(json.segments),
  };
}

async function transcribeElevenLabs(opts: TranscribeOptions): Promise<TranscribeResult> {
  const apiKey = opts.keys?.elevenlabs ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY for ElevenLabs transcription');
  }

  const model = opts.model ?? process.env.AI_TRANSCRIBE_MODEL ?? 'scribe_v2';
  const form = new FormData();
  form.append('file', await loadAudioBlob(opts), 'audio.m4a');
  form.append('model_id', model);
  form.append('timestamps_granularity', 'word');
  if (typeof opts.diarize === 'boolean') {
    form.append('diarize', String(opts.diarize));
  }

  const languageHint = resolveLanguageHint(opts.locale);
  if (languageHint) {
    form.append('language_code', languageHint);
  }

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs transcription failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    text?: string;
    language_code?: string;
    words?: ElevenLabsWord[];
  };

  const fullText = (json.text ?? '').trim();
  const segments = mapElevenLabsWordsToSegments(json.words, fullText);

  return {
    provider: 'elevenlabs',
    model,
    detectedLocale: mapDetectedLocale(json.language_code),
    fullText,
    segments,
  };
}

/**
 * Self-host: delegates to the faster-whisper worker exposed as an HTTP service.
 * See workers/ai-pipeline and infra/docker/Dockerfile.worker.
 */
async function transcribeLocal(opts: TranscribeOptions): Promise<TranscribeResult> {
  const baseUrl =
    opts.keys?.localBaseUrl ?? process.env.LOCAL_WHISPER_URL ?? 'http://localhost:9000';
  const res = await fetch(`${baseUrl}/transcribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: opts.audioUrl,
      model: opts.model,
      language: opts.locale === 'auto' ? undefined : opts.locale === 'pt-BR' ? 'pt' : 'en',
      diarize: opts.diarize ?? false,
    }),
  });
  if (!res.ok) throw new Error(`Local whisper failed: ${res.status}`);
  return (await res.json()) as TranscribeResult;
}

export async function embedTexts(
  texts: string[],
  opts: { provider?: 'openai' | 'ollama'; model?: string; keys?: ProviderKeys } = {},
): Promise<number[][]> {
  const requestedProvider =
    opts.provider ?? (process.env.AI_EMBEDDING_PROVIDER as 'openai' | 'ollama' | undefined);
  const hasOpenAIKey = Boolean(opts.keys?.openai ?? process.env.OPENAI_API_KEY);
  const provider =
    requestedProvider === 'openai' && !hasOpenAIKey
      ? 'ollama'
      : (requestedProvider ?? (hasOpenAIKey ? 'openai' : 'ollama'));
  const model =
    opts.model ??
    process.env.AI_EMBEDDING_MODEL ??
    (provider === 'openai' ? 'text-embedding-3-small' : 'nomic-embed-text');

  if (provider === 'openai') {
    const apiKey = opts.keys?.openai ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing OPENAI_API_KEY and no embedding fallback provider configured. Configure OpenAI key or select Ollama embeddings.',
      );
    }
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok) throw new Error(`Embeddings failed: ${res.status}`);
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return json.data.map((d) => d.embedding);
  }

  // Ollama
  const baseRoot = normalizeOllamaBaseUrl(opts.keys?.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL);
  const out: number[][] = [];
  for (const input of texts) {
    let res: Response;
    try {
      res = await fetch(`${baseRoot}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: input }),
      });
    } catch {
      throw new Error(`Ollama embed failed: service unreachable at ${baseRoot}`);
    }
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const json = (await res.json()) as { embedding: number[] };
    out.push(json.embedding);
  }
  return out;
}
