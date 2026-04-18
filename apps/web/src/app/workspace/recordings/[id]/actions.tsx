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
    return <p className="text-mute">Nenhuma ação detectada (ou ainda em processamento).</p>;
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
    <ul className="space-y-3 max-w-3xl">
      {items.map((a, i) => (
        <li key={a.id ?? i} className="card p-4 flex gap-3 items-start">
          <input
            type="checkbox"
            checked={!!a.done}
            onChange={() => toggle(i)}
            className="mt-1 h-4 w-4 accent-[#7c5cff]"
          />
          <div className="flex-1">
            <div className={a.done ? 'line-through text-mute' : ''}>{a.text}</div>
            {(a.assignee || a.dueDate) && (
              <div className="mt-1 text-xs text-mute flex gap-3">
                {a.assignee ? <span>👤 {a.assignee}</span> : null}
                {a.dueDate ? <span>📅 {a.dueDate}</span> : null}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
