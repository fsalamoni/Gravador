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
    <div className="max-w-3xl flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 && (
          <p className="text-mute">Faça uma pergunta sobre esta gravação.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                m.role === 'user' ? 'bg-accent text-white' : 'card'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
            </div>
          </div>
        ))}
        {isLoading && <p className="text-mute text-sm">{t('thinking')}</p>}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder={t('placeholder')}
          className="flex-1 bg-surfaceAlt border border-border rounded-lg px-4 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-accent text-white px-5 rounded-lg disabled:opacity-50"
        >
          →
        </button>
      </form>
    </div>
  );
}
