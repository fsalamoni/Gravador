'use client';

type Summary = { tldr: string; bullets: string[]; longform: string };

export function SummaryView({ payload }: { payload: unknown }) {
  const s = (payload as Summary | undefined) ?? null;
  if (!s) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
        Resumo em processamento…
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="card p-6">
        <div className="text-xs uppercase tracking-[0.28em] text-mute">TL;DR</div>
        <p className="mt-4 text-xl leading-8 text-text">{s.tldr}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr]">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.28em] text-mute">Pontos-chave</div>
          <ul className="mt-5 space-y-3">
            {s.bullets.map((b) => (
              <li
                key={b}
                className="flex gap-3 rounded-[22px] border border-border bg-bg/45 px-4 py-4"
              >
                <span className="mt-1 text-accent">•</span>
                <span className="leading-7 text-text">{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.28em] text-mute">Resumo completo</div>
          <p className="mt-5 whitespace-pre-wrap leading-8 text-text">{s.longform}</p>
        </div>
      </div>
    </div>
  );
}
