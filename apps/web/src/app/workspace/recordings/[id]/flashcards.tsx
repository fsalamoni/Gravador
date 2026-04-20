'use client';

import { useState } from 'react';

interface Card {
  q: string;
  a: string;
}

export function FlashcardsView({ payload }: { payload: unknown }) {
  const cards = (payload as Card[] | undefined) ?? [];
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  if (cards.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
        Flashcards processing…
      </div>
    );
  }

  const toggle = (i: number) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
      {cards.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => toggle(i)}
          aria-label={
            flipped.has(i) ? `Answer: ${c.a.slice(0, 50)}` : `Question: ${c.q.slice(0, 50)}`
          }
          className="group relative min-h-[140px] rounded-[24px] border border-border bg-bg/55 p-5 text-left transition hover:border-accent/40 hover:bg-surfaceAlt/80"
        >
          <span className="absolute right-4 top-4 rounded-full bg-surfaceAlt px-2 py-0.5 text-[10px] uppercase tracking-widest text-mute">
            {flipped.has(i) ? 'A' : 'Q'}
          </span>
          <p className="mt-2 leading-relaxed text-text">{flipped.has(i) ? c.a : c.q}</p>
          <p className="mt-3 text-xs text-mute">Click to flip</p>
        </button>
      ))}
    </div>
  );
}
