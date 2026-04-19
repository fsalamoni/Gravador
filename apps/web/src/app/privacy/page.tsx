import { AudioWaveform } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 pb-12 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-onAccent">
              <AudioWaveform className="h-5 w-5" />
            </div>
            <span className="display-title text-xl">Nexus</span>
          </Link>
        </header>

        <article className="prose prose-invert max-w-none space-y-6 text-mute">
          <h1 className="display-title text-4xl text-text">Política de Privacidade</h1>
          <p className="text-sm text-mute">Última atualização: 19 de abril de 2026</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">1. Dados Coletados</h2>
            <p>O Nexus coleta e processa os seguintes dados:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-text">Dados de conta:</strong> e-mail, nome e foto de perfil
                do Google, configurados durante autenticação.
              </li>
              <li>
                <strong className="text-text">Áudio:</strong> gravações enviadas pelo aplicativo
                mobile para processamento.
              </li>
              <li>
                <strong className="text-text">Transcrições e dados de IA:</strong> textos gerados a
                partir do processamento de áudio, incluindo resumos, itens de ação, mapas mentais e
                capítulos.
              </li>
              <li>
                <strong className="text-text">Dados de uso:</strong> metadados de gravações
                (duração, data, dispositivo).
              </li>
              <li>
                <strong className="text-text">Chaves de API (BYOK):</strong> quando fornecidas,
                armazenadas de forma cifrada e usadas exclusivamente para comunicação com o provedor
                de IA escolhido.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">2. Armazenamento de Áudio</h2>
            <p>
              Arquivos de áudio são armazenados no Firebase Storage (Google Cloud) associados à sua
              conta. O acesso aos arquivos é restrito ao proprietário e membros autorizados do
              workspace.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">
              3. Processamento por Provedores de IA
            </h2>
            <p>
              Para fornecer funcionalidades de transcrição, resumo e busca, o Nexus envia dados
              de áudio e texto para provedores de IA terceirizados. Os provedores utilizados
              incluem:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-text">Groq</strong> — transcrição (Whisper)
              </li>
              <li>
                <strong className="text-text">OpenAI</strong> — transcrição, embeddings, modelos de
                linguagem
              </li>
              <li>
                <strong className="text-text">Anthropic</strong> — modelos de linguagem
              </li>
              <li>
                <strong className="text-text">Google</strong> — modelos de linguagem
              </li>
              <li>
                <strong className="text-text">OpenRouter</strong> — gateway para múltiplos modelos
                de IA
              </li>
            </ul>
            <p>
              Cada provedor opera sob suas próprias políticas de privacidade. Quando você utiliza
              chaves de API próprias (BYOK), o processamento ocorre sob os termos do provedor
              diretamente com suas credenciais.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">
              4. Chaves de API (Bring Your Own Key)
            </h2>
            <p>
              Quando você fornece chaves de API próprias, estas são armazenadas de forma cifrada no
              servidor. As chaves são utilizadas exclusivamente para autenticar chamadas ao provedor
              de IA correspondente e nunca são expostas no frontend após o envio.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">5. Retenção de Dados</h2>
            <p>
              Seus dados são mantidos enquanto sua conta estiver ativa. Gravações podem ser
              excluídas individualmente pelo usuário. A exclusão da conta remove todos os dados
              associados.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">6. Compartilhamento de Dados</h2>
            <p>
              O Nexus não vende dados pessoais. Dados são compartilhados apenas com provedores de
              IA para processamento (conforme seção 3) e com o Google Cloud para infraestrutura de
              armazenamento e autenticação.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">7. Segurança</h2>
            <p>
              Utilizamos criptografia em trânsito (TLS) e em repouso. Sessões são gerenciadas via
              cookies HTTP-only. Chaves de API são cifradas antes do armazenamento.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">8. Seus Direitos</h2>
            <p>Você tem o direito de:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Acessar seus dados pessoais</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Exportar suas gravações e transcrições</li>
              <li>Revogar o consentimento de processamento por IA</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">9. Código Aberto</h2>
            <p>
              O Nexus é software de código aberto (AGPL-3.0). Você pode auditar o código para
              verificar como seus dados são tratados em{' '}
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
            <h2 className="text-xl font-semibold text-text">10. Alterações</h2>
            <p>
              Esta política pode ser atualizada periodicamente. Alterações significativas serão
              comunicadas através do Serviço.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-text">11. Contato</h2>
            <p>
              Para questões sobre privacidade, entre em contato através do repositório no GitHub.
            </p>
          </section>
        </article>

        <footer className="mt-12 flex gap-4 text-sm text-mute">
          <Link href="/" className="transition hover:text-text">
            Início
          </Link>
          <Link href="/terms" className="transition hover:text-text">
            Termos de Uso
          </Link>
          <Link href="/docs" className="transition hover:text-text">
            Docs
          </Link>
        </footer>
      </div>
    </main>
  );
}
