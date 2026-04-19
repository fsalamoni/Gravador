import { AudioWaveform } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 pb-12 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-onAccent">
              <AudioWaveform className="h-5 w-5" />
            </div>
            <span className="display-title text-xl">Gravador</span>
          </Link>
        </header>

        <article className="prose prose-invert max-w-none space-y-6 text-mute">
          <h1 className="display-title text-4xl text-text">Termos de Uso</h1>
          <p className="text-sm text-mute">Última atualização: 19 de abril de 2026</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar o Gravador (&quot;Serviço&quot;), você concorda com estes
              Termos de Uso. Se não concordar, não utilize o Serviço.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">2. Descrição do Serviço</h2>
            <p>
              O Gravador é uma plataforma de workspace de áudio com inteligência artificial que
              permite gravar, transcrever, resumir e buscar informações em gravações de áudio. O
              Serviço consiste em um aplicativo mobile (Android/iOS) e um workspace web.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">3. Conta e Autenticação</h2>
            <p>
              O acesso ao Serviço requer autenticação via conta Google. Você é responsável por
              manter a segurança de sua conta Google e por todas as atividades realizadas sob sua
              sessão.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">4. Conteúdo do Usuário</h2>
            <p>
              Você retém todos os direitos sobre o conteúdo de áudio que envia ao Serviço. Ao
              utilizar o Serviço, você concede ao Gravador uma licença limitada para processar seu
              conteúdo exclusivamente para fornecer as funcionalidades do produto (transcrição,
              resumo, busca, etc.).
            </p>
            <p>
              Você é responsável por obter o consentimento de terceiros cuja voz possa estar
              presente em suas gravações, conforme exigido pela legislação aplicável.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">5. Processamento por IA</h2>
            <p>
              O Serviço utiliza provedores de inteligência artificial de terceiros (como OpenAI,
              Anthropic, Google, Groq e OpenRouter) para transcrição, resumo e outras
              funcionalidades. Ao utilizar o Serviço, você consente com o processamento de seu
              conteúdo por esses provedores.
            </p>
            <p>
              Quando você configura chaves de API próprias (BYOK), o processamento é realizado
              diretamente entre o Serviço e o provedor escolhido, usando suas credenciais.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">6. Uso Aceitável</h2>
            <p>Você concorda em não utilizar o Serviço para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Violar leis ou regulamentos aplicáveis</li>
              <li>Gravar conversas sem o consentimento das partes envolvidas</li>
              <li>Gerar, armazenar ou distribuir conteúdo ilegal</li>
              <li>Tentar acessar dados de outros usuários</li>
              <li>Sobrecarregar intencionalmente a infraestrutura do Serviço</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">7. Disponibilidade</h2>
            <p>
              O Serviço é fornecido &quot;como está&quot;. Não garantimos disponibilidade
              ininterrupta. Podemos modificar, suspender ou descontinuar o Serviço a qualquer
              momento.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">8. Código Aberto</h2>
            <p>
              O Gravador é software de código aberto, licenciado sob a AGPL-3.0. O código-fonte
              está disponível em{' '}
              <a
                href="https://github.com/fsalamoni/gravador"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                github.com/fsalamoni/gravador
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">9. Limitação de Responsabilidade</h2>
            <p>
              Na extensão máxima permitida pela lei aplicável, o Gravador não será responsável por
              danos indiretos, incidentais, especiais ou consequentes decorrentes do uso do Serviço.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">10. Alterações</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Alterações significativas serão
              comunicadas através do Serviço. O uso continuado após alterações constitui aceitação
              dos novos termos.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">11. Contato</h2>
            <p>
              Para questões sobre estes Termos, entre em contato através do repositório no GitHub.
            </p>
          </section>
        </article>

        <footer className="mt-12 flex gap-4 text-sm text-mute">
          <Link href="/" className="transition hover:text-text">
            Início
          </Link>
          <Link href="/privacy" className="transition hover:text-text">
            Privacidade
          </Link>
          <Link href="/docs" className="transition hover:text-text">
            Docs
          </Link>
        </footer>
      </div>
    </main>
  );
}
