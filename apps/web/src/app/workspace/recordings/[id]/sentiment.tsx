'use client';

interface SentimentData {
  overall: number;
  perChapter: Record<string, number>;
}

function sentimentLabel(val: number): string {
  if (val > 0.3) return 'Positive';
  if (val < -0.3) return 'Negative';
  return 'Neutral';
}

function sentimentColor(val: number): string {
  if (val > 0.3) return 'text-ok';
  if (val < -0.3) return 'text-danger';
  return 'text-mute';
}

function barWidth(val: number): string {
  return `${Math.round(((val + 1) / 2) * 100)}%`;
}

export function SentimentView({ payload }: { payload: unknown }) {
  const data = payload as SentimentData | undefined;
  if (!data) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
        Sentiment analysis processing…
      </div>
    );
  }

  const chapters = Object.entries(data.perChapter ?? {});

  return (
    <div className="max-w-4xl space-y-6">
      {/* Overall */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-mute">
          Overall Sentiment
        </h3>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surfaceAlt">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: barWidth(data.overall) }}
            />
          </div>
          <span className={`text-2xl font-bold ${sentimentColor(data.overall)}`}>
            {sentimentLabel(data.overall)}
          </span>
          <span className="font-mono text-sm text-mute">
            {data.overall > 0 ? '+' : ''}
            {data.overall.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Per chapter */}
      {chapters.length > 0 && (
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-mute">Per Chapter</h3>
          {chapters.map(([key, val]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 truncate text-sm text-text">{key}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surfaceAlt">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: barWidth(val) }}
                />
              </div>
              <span className={`w-16 text-right font-mono text-xs ${sentimentColor(val)}`}>
                {val > 0 ? '+' : ''}
                {val.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
