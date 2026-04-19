'use client';

import { useChat } from '@ai-sdk/react';
import type { Message } from 'ai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';

export function ChatView({ recordingId }: { recordingId: string }) {
  const t = useTranslations('chat');
  const persisted = useRef(false);
  const lastLen = useRef(0);

  const { messages, setMessages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { recordingId },
  });

  // Load history once on mount
  useEffect(() => {
    if (persisted.current) return;
    persisted.current = true;
    fetch(`/api/chat-history?recordingId=${encodeURIComponent(recordingId)}`)
      .then((r) => r.json())
      .then((data: { messages?: Array<{ id: string; role: string; content: string }> }) => {
        if (data.messages?.length) {
          setMessages(
            data.messages.map((m) => ({ id: m.id, role: m.role as Message['role'], content: m.content })),
          );
          lastLen.current = data.messages.length;
        }
      })
      .catch(() => {});
  }, [recordingId, setMessages]);

  // Persist new messages after assistant finishes
  const persistNew = useCallback(
    (msgs: Message[]) => {
      if (msgs.length <= lastLen.current) return;
      const newMsgs = msgs.slice(lastLen.current);
      lastLen.current = msgs.length;
      fetch('/api/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId,
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      }).catch(() => {});
    },
    [recordingId],
  );

  useEffect(() => {
    if (!isLoading && messages.length > lastLen.current) {
      persistNew(messages);
    }
  }, [isLoading, messages, persistNew]);

  return (
    <div className="card flex h-[calc(100dvh-16rem)] min-h-[320px] max-h-[70vh] max-w-4xl flex-col p-4 sm:p-5">
      <div className="flex-1 space-y-4 overflow-y-auto pr-2" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-border bg-bg/35 px-5 py-8 text-center text-sm text-mute">
            Faça uma pergunta sobre esta gravação.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-[24px] px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-accent text-onAccent'
                  : 'border border-border bg-bg/55 text-text'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
            </div>
          </div>
        ))}
        {isLoading && <p className="text-mute text-sm">{t('thinking')}</p>}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <div className="flex flex-1 items-center rounded-[22px] border border-border bg-surfaceAlt/70 px-4">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="w-full bg-transparent py-3 text-text outline-none placeholder:text-mute"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-[22px] bg-accent px-5 font-semibold text-onAccent disabled:opacity-50"
          aria-label="Send message"
        >
          →
        </button>
      </form>
    </div>
  );
}
