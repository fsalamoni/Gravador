'use client';

interface Quote {
  text: string;
  segmentId: string;
  speakerId: string | null;
  reason: string;
}

export function QuotesView({ payload }: { payload: unknown }) {
  const quotes = (payload as Quote[] | undefined) ?? [];
  if (quotes.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
        Quotes processing…
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      {quotes.map((q, i) => (
        <button
          key={i}
          type="button"
          onClick={() =>
            (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek?.(0)
          }
          aria-label={`Quote: ${q.text.slice(0, 50)}`}
          className="group block w-full rounded-[24px] border border-border bg-bg/55 p-5 text-left transition hover:border-accent/40 hover:bg-surfaceAlt/80"
        >
          <blockquote className="text-lg leading-relaxed text-text italic">
            &ldquo;{q.text}&rdquo;
          </blockquote>
          {q.speakerId && (
            <span className="mt-2 inline-block rounded-full border border-border px-3 py-1 text-xs text-mute">
              {q.speakerId}
            </span>
          )}
          <p className="mt-2 text-sm text-mute">{q.reason}</p>
        </button>
      ))}
    </div>
  );
}
