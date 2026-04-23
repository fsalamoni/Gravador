import { type LanguageModel, generateObject, generateText } from 'ai';
import type { z } from 'zod';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? 'Unknown error');
}

function isStructuredOutputCapabilityError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return [
    'no endpoints found that support tool use',
    'does not support tool',
    'tool use',
    'disable "json"',
    'json_schema',
    'response_format',
    'structured output',
    'invalid response format',
  ].some((token) => message.includes(token));
}

function collectJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const pushCandidate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  };

  pushCandidate(text);

  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of text.matchAll(codeBlockRegex)) {
    if (match[1]) pushCandidate(match[1]);
  }

  const firstObject = text.indexOf('{');
  const lastObject = text.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    pushCandidate(text.slice(firstObject, lastObject + 1));
  }

  const firstArray = text.indexOf('[');
  const lastArray = text.lastIndexOf(']');
  if (firstArray >= 0 && lastArray > firstArray) {
    pushCandidate(text.slice(firstArray, lastArray + 1));
  }

  return candidates;
}

function parseStructuredJson<TSchema extends z.ZodTypeAny>(
  text: string,
  schema: TSchema,
): z.infer<TSchema> {
  let lastError: unknown;
  for (const candidate of collectJsonCandidates(text)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return schema.parse(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  const details = getErrorMessage(lastError);
  throw new Error(`Failed to parse structured JSON output: ${details}`);
}

export async function generateStructuredObject<TSchema extends z.ZodTypeAny>(options: {
  model: LanguageModel;
  schema: TSchema;
  system?: string;
  prompt: string;
  temperature?: number;
}): Promise<z.infer<TSchema>> {
  try {
    const { object } = await generateObject({
      model: options.model,
      schema: options.schema,
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature,
    });
    return object;
  } catch (error) {
    if (!isStructuredOutputCapabilityError(error)) {
      throw error;
    }

    const fallbackSystem = [
      options.system,
      'Return only strict JSON. Do not include markdown, explanations, or extra keys.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const { text } = await generateText({
      model: options.model,
      system: fallbackSystem,
      prompt: options.prompt,
      temperature: options.temperature,
    });

    return parseStructuredJson(text, options.schema);
  }
}
