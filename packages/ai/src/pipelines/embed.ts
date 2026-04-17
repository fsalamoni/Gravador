import type { TranscriptSegment } from '@gravador/core';
import { type ProviderKeys, embedTexts } from '../providers/index.ts';

/**
 * Chunk the transcript into ~400 token windows with 50 token overlap,
 * preserving segment boundaries for RAG retrieval.
 */
export interface Chunk {
  content: string;
  startMs: number;
  endMs: number;
  startSegmentId: string;
  endSegmentId: string;
}

const APPROX_CHARS_PER_TOKEN = 4;
const CHUNK_TOKENS = 400;
const OVERLAP_TOKENS = 50;

export function chunkSegments(segments: TranscriptSegment[]): Chunk[] {
  const chunkSize = CHUNK_TOKENS * APPROX_CHARS_PER_TOKEN;
  const overlap = OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

  const chunks: Chunk[] = [];
  let current: TranscriptSegment[] = [];
  let currentChars = 0;

  for (const seg of segments) {
    if (currentChars + seg.text.length > chunkSize && current.length > 0) {
      chunks.push(finalize(current));
      const overlapSegs: TranscriptSegment[] = [];
      let oc = 0;
      for (let i = current.length - 1; i >= 0 && oc < overlap; i--) {
        overlapSegs.unshift(current[i]!);
        oc += current[i]!.text.length;
      }
      current = [...overlapSegs, seg];
      currentChars = oc + seg.text.length;
    } else {
      current.push(seg);
      currentChars += seg.text.length;
    }
  }
  if (current.length > 0) chunks.push(finalize(current));
  return chunks;
}

function finalize(segs: TranscriptSegment[]): Chunk {
  const first = segs[0]!;
  const last = segs[segs.length - 1]!;
  return {
    content: segs.map((s) => s.text).join(' '),
    startMs: first.startMs,
    endMs: last.endMs,
    startSegmentId: first.id,
    endSegmentId: last.id,
  };
}

export async function chunkAndEmbed(
  segments: TranscriptSegment[],
  opts: { provider?: 'openai' | 'ollama'; model?: string; keys?: ProviderKeys } = {},
) {
  const chunks = chunkSegments(segments);
  if (chunks.length === 0) return [];
  const embeddings = await embedTexts(
    chunks.map((c) => c.content),
    opts,
  );
  return chunks.map((c, i) => ({ ...c, embedding: embeddings[i]! }));
}
