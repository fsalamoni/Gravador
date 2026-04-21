'use client';

import { useState } from 'react';

export function IosWaitlistForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const normalized = email.trim();
    if (!normalized) {
      setMessage('Informe um e-mail para entrar na lista de espera.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/download/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalized,
          name: name.trim() || undefined,
          platform: 'ios',
        }),
      });

      if (!res.ok) {
        throw new Error('Não foi possível registrar sua inscrição agora.');
      }

      setEmail('');
      setName('');
      setMessage('Você entrou na lista de espera do iOS. Avisaremos por e-mail.');
    } catch {
      setMessage('Falha ao enviar. Tente novamente em instantes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-5 space-y-3 rounded-[18px] border border-border bg-bg/55 p-4">
      <p className="text-sm font-semibold text-text">Lista de espera do iOS</p>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Seu nome (opcional)"
        className="w-full rounded-[14px] border border-border bg-bg/70 px-3 py-2 text-sm text-text outline-none focus:border-accent/60"
      />
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Seu melhor e-mail"
        className="w-full rounded-[14px] border border-border bg-bg/70 px-3 py-2 text-sm text-text outline-none focus:border-accent/60"
      />
      <button
        type="button"
        disabled={isSubmitting}
        onClick={submit}
        className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-onAccent transition hover:bg-accentSoft disabled:opacity-60"
      >
        {isSubmitting ? 'Enviando...' : 'Entrar na lista de espera'}
      </button>
      {message ? <p className="text-xs leading-5 text-mute">{message}</p> : null}
    </div>
  );
}
