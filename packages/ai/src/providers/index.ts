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
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'llama3.1:70b'
  | 'llama3.1:8b'
  | (string & {});

export interface ProviderKeys {
  openai?: string;
  anthropic?: string;
  groq?: string;
  google?: string;
  ollamaBaseUrl?: string;
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
  switch (provider) {
    case 'anthropic': {
      const apiKey = keys.anthropic ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
      return createAnthropic({ apiKey })(model);
    }
    case 'openai': {
      const apiKey = keys.openai ?? process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
      return createOpenAI({ apiKey })(model);
    }
    case 'google': {
      const apiKey = keys.google ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
      return createGoogleGenerativeAI({ apiKey })(model);
    }
    case 'groq': {
      const apiKey = keys.groq ?? process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('Missing GROQ_API_KEY');
      return createGroq({ apiKey })(model);
    }
    case 'ollama': {
      const baseURL =
        keys.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/api';
      // Ollama provider ships its own @ai-sdk/provider copy; cast to unblock the version gap
      return createOllama({ baseURL })(model) as unknown as LanguageModel;
    }
  }
}

export interface TranscribeOptions {
  audioUrl?: string;
  audioBytes?: ArrayBuffer;
  locale?: 'pt-BR' | 'en' | 'auto';
  provider?: 'groq' | 'openai' | 'local-faster-whisper';
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

/**
 * Unified transcription entrypoint. Under the hood delegates to the selected
 * provider. Groq Whisper v3 is the fastest cloud option (often <1x realtime);
 * local `faster-whisper` is used in self-host mode.
 */
export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
  const provider =
    opts.provider ??
    (process.env.AI_TRANSCRIBE_PROVIDER as TranscribeOptions['provider']) ??
    'groq';
  if (provider === 'groq') return transcribeGroq(opts);
  if (provider === 'openai') return transcribeOpenAI(opts);
  return transcribeLocal(opts);
}

async function transcribeGroq(opts: TranscribeOptions): Promise<TranscribeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY for Groq transcription');
  const form = new FormData();
  if (opts.audioBytes) {
    form.append('file', new Blob([opts.audioBytes]), 'audio.m4a');
  } else if (opts.audioUrl) {
    const res = await fetch(opts.audioUrl);
    form.append('file', new Blob([await res.arrayBuffer()]), 'audio.m4a');
  } else {
    throw new Error('audioUrl or audioBytes required');
  }
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  if (opts.locale && opts.locale !== 'auto') {
    form.append('language', opts.locale === 'pt-BR' ? 'pt' : 'en');
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
    model: 'whisper-large-v3',
    detectedLocale: json.language?.startsWith('pt')
      ? 'pt-BR'
      : json.language === 'en'
        ? 'en'
        : null,
    fullText: json.text,
    segments: (json.segments ?? []).map((s) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
      confidence: typeof s.avg_logprob === 'number' ? Math.exp(s.avg_logprob) : null,
      speakerId: null,
    })),
  };
}

async function transcribeOpenAI(opts: TranscribeOptions): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const form = new FormData();
  if (opts.audioBytes) {
    form.append('file', new Blob([opts.audioBytes]), 'audio.m4a');
  } else if (opts.audioUrl) {
    const res = await fetch(opts.audioUrl);
    form.append('file', new Blob([await res.arrayBuffer()]), 'audio.m4a');
  } else {
    throw new Error('audioUrl or audioBytes required');
  }
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  if (opts.locale && opts.locale !== 'auto') {
    form.append('language', opts.locale === 'pt-BR' ? 'pt' : 'en');
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
    model: 'whisper-1',
    detectedLocale: json.language?.startsWith('pt')
      ? 'pt-BR'
      : json.language === 'en'
        ? 'en'
        : null,
    fullText: json.text,
    segments: (json.segments ?? []).map((s) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
      confidence: typeof s.avg_logprob === 'number' ? Math.exp(s.avg_logprob) : null,
      speakerId: null,
    })),
  };
}

/**
 * Self-host: delegates to the faster-whisper worker exposed as an HTTP service.
 * See workers/ai-pipeline and infra/docker/Dockerfile.worker.
 */
async function transcribeLocal(opts: TranscribeOptions): Promise<TranscribeResult> {
  const baseUrl = process.env.LOCAL_WHISPER_URL ?? 'http://localhost:9000';
  const res = await fetch(`${baseUrl}/transcribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: opts.audioUrl,
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
  const provider =
    opts.provider ?? (process.env.AI_EMBEDDING_PROVIDER as 'openai' | 'ollama') ?? 'openai';
  const model =
    opts.model ??
    process.env.AI_EMBEDDING_MODEL ??
    (provider === 'openai' ? 'text-embedding-3-small' : 'nomic-embed-text');

  if (provider === 'openai') {
    const apiKey = opts.keys?.openai ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
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
  const baseURL =
    opts.keys?.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const out: number[][] = [];
  for (const input of texts) {
    const res = await fetch(`${baseURL}/api/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: input }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const json = (await res.json()) as { embedding: number[] };
    out.push(json.embedding);
  }
  return out;
}
