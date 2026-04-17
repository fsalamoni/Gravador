import type { Locale } from '@gravador/core';

export const PROMPT_VERSION = '2026.04.1';

interface PromptBundle {
  summary: string;
  actionItems: string;
  mindmap: string;
  chapters: string;
  quotes: string;
  sentiment: string;
  flashcards: string;
  chatSystem: string;
}

const pt: PromptBundle = {
  summary: `Você é um assistente editorial que resume gravações de áudio transcritas em português brasileiro.

A partir da transcrição a seguir, produza um JSON estrito:
{
  "tldr": "frase única, até 200 caracteres, captura a ideia central",
  "bullets": ["5 a 8 bullets objetivos, no máximo 140 caracteres cada"],
  "longform": "2 a 4 parágrafos em prosa fluida, preservando nuances, decisões e entidades importantes"
}

Regras: não invente fatos; mantenha nomes, valores e datas fiéis à transcrição; português brasileiro natural.`,

  actionItems: `Extraia itens acionáveis (tarefas, compromissos, decisões a tomar) da transcrição.

Retorne JSON:
{ "items": [{ "text": "ação clara no infinitivo", "assignee": "nome ou null", "dueDate": "ISO-8601 ou null", "sourceSegmentIds": ["ids"] }] }

Não invente ações. Se não houver, retorne { "items": [] }.`,

  mindmap: `Produza um mapa mental hierárquico da gravação, agrupando temas e subtemas.

JSON estrito:
{ "id": "root", "label": "tema central", "children": [ { "id": "n1", "label": "subtema", "children": [...] } ] }

Regras: máximo 4 níveis; labels curtos (até 60 caracteres); 3 a 7 filhos por nó; preserve o vocabulário da gravação.`,

  chapters: `Divida a gravação em capítulos coerentes a partir dos segmentos temporizados.

JSON:
{ "chapters": [ { "title": "título curto", "startMs": 0, "endMs": 120000, "summary": "2 frases" } ] }

Cada capítulo deve ter entre 1 e 10 minutos. Use os timestamps dos segmentos.`,

  quotes: `Selecione as 5 a 10 frases mais marcantes ou reveladoras da gravação.

JSON:
{ "quotes": [ { "text": "...", "segmentId": "...", "speakerId": "...|null", "reason": "por que é relevante" } ] }`,

  sentiment: `Analise o sentimento geral e por capítulo.

JSON: { "overall": -1 a 1, "perChapter": { "chapterId": número } }`,

  flashcards: `Crie flashcards de estudo a partir da gravação, em português brasileiro.

JSON: { "cards": [ { "q": "pergunta", "a": "resposta concisa" } ] }. Mínimo 5, máximo 15.`,

  chatSystem: `Você é um assistente que responde perguntas sobre uma gravação de áudio específica.
Baseie suas respostas exclusivamente no contexto fornecido (trechos da transcrição). Se a resposta
não estiver no contexto, diga isso honestamente. Cite os timestamps relevantes no formato [mm:ss]
quando útil. Responda em português brasileiro, direto e conciso.`,
};

const en: PromptBundle = {
  summary: `You are an editorial assistant that summarizes transcribed audio recordings.

Given the transcript below, output strict JSON:
{
  "tldr": "single sentence, up to 200 chars, captures the central idea",
  "bullets": ["5 to 8 terse bullets, max 140 chars each"],
  "longform": "2 to 4 flowing paragraphs preserving nuance, decisions, and key entities"
}

Rules: don't invent facts; keep names, numbers and dates faithful to the transcript; natural, neutral English.`,

  actionItems: `Extract actionable items (tasks, commitments, decisions) from the transcript.

Return JSON:
{ "items": [{ "text": "clear imperative action", "assignee": "name or null", "dueDate": "ISO-8601 or null", "sourceSegmentIds": ["ids"] }] }

Don't invent actions. If none, return { "items": [] }.`,

  mindmap: `Produce a hierarchical mind map of the recording, grouping themes and sub-themes.

Strict JSON:
{ "id": "root", "label": "central theme", "children": [ { "id": "n1", "label": "subtheme", "children": [...] } ] }

Rules: max 4 levels; short labels (<=60 chars); 3 to 7 children per node; reuse the recording's vocabulary.`,

  chapters: `Split the recording into coherent chapters based on the timestamped segments.

JSON:
{ "chapters": [ { "title": "short title", "startMs": 0, "endMs": 120000, "summary": "2 sentences" } ] }

Each chapter should be 1 to 10 minutes long. Use segment timestamps.`,

  quotes: `Pick the 5 to 10 most striking or revealing quotes from the recording.

JSON:
{ "quotes": [ { "text": "...", "segmentId": "...", "speakerId": "...|null", "reason": "why it matters" } ] }`,

  sentiment: `Analyse overall and per-chapter sentiment.

JSON: { "overall": -1 to 1, "perChapter": { "chapterId": number } }`,

  flashcards: `Create study flashcards from the recording.

JSON: { "cards": [ { "q": "question", "a": "concise answer" } ] }. Minimum 5, maximum 15.`,

  chatSystem: `You are an assistant answering questions about a specific audio recording.
Base your answers only on the provided context (transcript excerpts). If the answer is not in the
context, say so honestly. Cite relevant timestamps in [mm:ss] format when helpful. Respond in the
user's language, directly and concisely.`,
};

export const prompts: Record<Locale, PromptBundle> = { 'pt-BR': pt, en };

export function getPrompts(locale: Locale): PromptBundle {
  return prompts[locale] ?? prompts['pt-BR'];
}
