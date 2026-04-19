'use client';

import { db } from '@/lib/firebase-browser';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';

interface ActionItem {
  id: string;
  text: string;
  assignee: string | null;
  dueDate: string | null;
  done: boolean;
}

export function ActionsView({
  items: initialItems,
  recordingId,
}: {
  items: ActionItem[];
  recordingId: string;
}) {
  const [items, setItems] = useState<ActionItem[]>(initialItems);

  if (items.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
        Nenhuma ação detectada (ou ainda em processamento).
      </div>
    );
  }

  const toggle = async (idx: number) => {
    const prev = [...items];
    const next = [...items];
    const curr = next[idx]!;
    next[idx] = { ...curr, done: !curr.done };
    setItems(next);
    try {
      const itemRef = doc(db, 'recordings', recordingId, 'action_items', curr.id);
      await updateDoc(itemRef, { done: next[idx]!.done });
    } catch {
      setItems(prev); // revert optimistic update
    }
  };

  return (
    <ul className="max-w-4xl space-y-3">
      {items.map((a, i) => (
        <li key={a.id ?? i} className="card flex items-start gap-4 p-5">
          <input
            type="checkbox"
            checked={!!a.done}
            onChange={() => toggle(i)}
            aria-label={`Mark "${a.text.slice(0, 50)}" as ${a.done ? 'not done' : 'done'}`}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <div className="flex-1">
            <div className={a.done ? 'leading-7 text-mute line-through' : 'leading-7 text-text'}>
              {a.text}
            </div>
            {(a.assignee || a.dueDate) && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-mute">
                {a.assignee ? (
                  <span className="rounded-full border border-border px-3 py-1">
                    Owner {a.assignee}
                  </span>
                ) : null}
                {a.dueDate ? (
                  <span className="rounded-full border border-border px-3 py-1">
                    Due {a.dueDate}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
