'use client';

import { useChat } from '@ai-sdk/react';
import { useTranslations } from 'next-intl';

export function ChatView({ recordingId }: { recordingId: string }) {
  const t = useTranslations('chat');
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { recordingId },
  });

  return (
    <div className="card flex h-[60vh] max-w-4xl flex-col p-4 sm:p-5">
      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        {messages.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-border bg-[#100c09]/35 px-5 py-8 text-center text-sm text-mute">
            Faça uma pergunta sobre esta gravação.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-[24px] px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-accent text-[#120d0a]'
                  : 'border border-border bg-[#100c09]/55 text-text'
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
            className="w-full bg-transparent py-3 text-text outline-none placeholder:text-mute"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-[22px] bg-accent px-5 font-semibold text-[#120d0a] disabled:opacity-50"
        >
          →
        </button>
      </form>
    </div>
  );
}
