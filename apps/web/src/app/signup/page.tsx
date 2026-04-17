import Link from 'next/link';

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-semibold mb-3">Criar conta</h1>
        <p className="text-mute mb-6 text-sm">
          Usamos magic link. Basta informar seu e-mail na tela de login e pronto.
        </p>
        <Link
          href="/login"
          className="bg-accent text-white rounded-lg py-3 px-5 inline-block hover:bg-accentSoft"
        >
          Ir para login
        </Link>
      </div>
    </main>
  );
}
