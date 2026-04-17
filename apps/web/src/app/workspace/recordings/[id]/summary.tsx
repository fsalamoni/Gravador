'use client';

type Summary = { tldr: string; bullets: string[]; longform: string };

export function SummaryView({ payload }: { payload: unknown }) {
  const s = (payload as Summary | undefined) ?? null;
  if (!s) {
    return <p className="text-mute">Resumo em processamento…</p>;
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div className="card p-5">
        <div className="text-mute text-xs uppercase tracking-widest mb-2">TL;DR</div>
        <p className="text-lg">{s.tldr}</p>
      </div>
      <div>
        <div className="text-mute text-xs uppercase tracking-widest mb-3">Pontos-chave</div>
        <ul className="space-y-2">
          {s.bullets.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: summary bullets are a stable ordered list
            <li key={i} className="flex gap-3">
              <span className="text-accent mt-1">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-mute text-xs uppercase tracking-widest mb-3">Resumo completo</div>
        <p className="whitespace-pre-wrap leading-relaxed">{s.longform}</p>
      </div>
    </div>
  );
}
