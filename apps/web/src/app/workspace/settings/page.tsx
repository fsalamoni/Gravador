import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { AppearanceSection } from './appearance-section';

export default async function SettingsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold mb-6">Configurações</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <SettingsNavCard
          href="/workspace/settings/account"
          title="Conta"
          description="Gerencie e-mail, senha e dados pessoais."
          icon="👤"
        />
        <SettingsNavCard
          href="/workspace/settings/appearance"
          title="Aparência"
          description="Escolha o tema claro, escuro ou outro."
          icon="🎨"
        />
        <SettingsNavCard
          href="/workspace/settings/ai-providers"
          title="Provedores de IA"
          description="Chaves de API e catálogo de modelos."
          icon="🤖"
        />
        <SettingsNavCard
          href="/workspace/settings/agents"
          title="Agentes"
          description="Configure modelos por agente e transcrição."
          icon="⚙️"
        />
        <SettingsNavCard
          href="/workspace/settings/security"
          title="Segurança"
          description="Autenticação em dois fatores e sessões."
          icon="🔒"
        />
      </div>

      <h2 className="text-xl font-medium mb-3">Conta</h2>
      <div className="card p-6 space-y-4 mb-10">
        <Field label="E-mail" value={user?.email ?? '-'} />
        <Field label="User ID" value={user?.id ?? '-'} />
      </div>

      <h2 className="text-xl font-medium mb-3">Aparência</h2>
      <div className="card p-6 mb-10">
        <AppearanceSection />
      </div>

      <h2 className="text-xl font-medium mb-3">Provedores de IA (BYOK)</h2>
      <p className="text-mute text-sm mb-4">
        Traga suas próprias chaves para usar modelos cloud sem compartilhar custos com o Gravador.
        Chaves são cifradas em repouso e usadas somente para suas gravações.
      </p>
      <div className="card p-6 mb-10">
        <AiProvidersCatalog />
      </div>

      <h2 className="text-xl font-medium mb-3">Modelos por Agente — Provedores de Transcrição</h2>
      <div className="card p-6 mb-10">
        <TranscriptionProvidersInfo />
      </div>

      <h2 className="text-xl font-medium mb-3">Segurança</h2>
      <div className="card p-6 text-mute text-sm">
        Autenticação em dois fatores e gerenciamento de sessões — em breve.
      </div>
    </div>
  );
}

function SettingsNavCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link href={href} className="card p-5 hover:border-accent transition block">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-mute text-sm mt-0.5">{description}</div>
        </div>
      </div>
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-mute text-xs uppercase tracking-widest">{label}</div>
      <div className="mt-1 font-mono text-sm break-all">{value}</div>
    </div>
  );
}

function AiProvidersCatalog() {
  const providers = [
    {
      name: 'OpenAI',
      slug: 'openai',
      description: 'GPT-4.1, GPT-4.1 mini, GPT-4o, o3, o4-mini e todos os modelos disponíveis.',
      models: [
        'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini',
        'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o3', 'o3-mini', 'o4-mini',
        'o1', 'o1-mini', 'o1-preview',
        'gpt-4o-realtime-preview', 'gpt-4o-audio-preview', 'gpt-4o-mini-realtime-preview',
        'chatgpt-4o-latest', 'gpt-4.1-2025-04-14',
        'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002',
        'whisper-1', 'tts-1', 'tts-1-hd', 'dall-e-3', 'dall-e-2',
      ],
    },
    {
      name: 'Anthropic',
      slug: 'anthropic',
      description: 'Claude Opus, Sonnet, Haiku e todas as variantes disponíveis.',
      models: [
        'claude-opus-4-0722', 'claude-opus-4-20250514',
        'claude-sonnet-4-0514', 'claude-sonnet-4-20250514',
        'claude-sonnet-4-6-20250620',
        'claude-3.5-sonnet-20241022', 'claude-3.5-sonnet-20240620',
        'claude-3.5-haiku-20241022',
        'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307',
        'claude-2.1', 'claude-2.0', 'claude-instant-1.2',
      ],
    },
    {
      name: 'Google',
      slug: 'google',
      description: 'Gemini 2.5 Pro, Flash, e todos os modelos do Google AI.',
      models: [
        'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite-preview-06-17',
        'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash-thinking-exp',
        'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b',
        'gemini-1.0-pro', 'gemini-pro-vision',
        'text-embedding-004', 'embedding-001',
        'imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001',
      ],
    },
    {
      name: 'Groq',
      slug: 'groq',
      description: 'Llama, Mixtral, Gemma e modelos otimizados para velocidade.',
      models: [
        'llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant',
        'llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview',
        'llama-3.2-3b-preview', 'llama-3.2-1b-preview',
        'llama3-groq-70b-8192-tool-use-preview', 'llama3-groq-8b-8192-tool-use-preview',
        'llama3-70b-8192', 'llama3-8b-8192',
        'mixtral-8x7b-32768', 'gemma2-9b-it', 'gemma-7b-it',
        'whisper-large-v3', 'whisper-large-v3-turbo',
        'distil-whisper-large-v3-en',
        'llama-guard-3-8b', 'llava-v1.5-7b-4096-preview',
        'qwen-2.5-coder-32b', 'qwen-2.5-32b', 'deepseek-r1-distill-llama-70b',
      ],
    },
    {
      name: 'OpenRouter',
      slug: 'openrouter',
      description: 'Agregador com acesso a centenas de modelos de diversos provedores. Todos os modelos disponíveis no OpenRouter estão listados abaixo.',
      models: [
        // Meta Llama
        'meta-llama/llama-3.3-70b-instruct', 'meta-llama/llama-3.1-405b-instruct',
        'meta-llama/llama-3.1-70b-instruct', 'meta-llama/llama-3.1-8b-instruct',
        'meta-llama/llama-3.2-90b-vision-instruct', 'meta-llama/llama-3.2-11b-vision-instruct',
        'meta-llama/llama-3.2-3b-instruct', 'meta-llama/llama-3.2-1b-instruct',
        'meta-llama/llama-3-70b-instruct', 'meta-llama/llama-3-8b-instruct',
        'meta-llama/llama-guard-2-8b',
        // OpenAI via OpenRouter
        'openai/gpt-4.1', 'openai/gpt-4.1-mini', 'openai/gpt-4.1-nano',
        'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo',
        'openai/o3', 'openai/o3-mini', 'openai/o4-mini', 'openai/o1', 'openai/o1-mini',
        'openai/chatgpt-4o-latest',
        // Anthropic via OpenRouter
        'anthropic/claude-opus-4', 'anthropic/claude-sonnet-4',
        'anthropic/claude-3.5-sonnet', 'anthropic/claude-3.5-haiku',
        'anthropic/claude-3-opus', 'anthropic/claude-3-sonnet', 'anthropic/claude-3-haiku',
        // Google via OpenRouter
        'google/gemini-2.5-pro-preview', 'google/gemini-2.5-flash-preview',
        'google/gemini-2.0-flash-001', 'google/gemini-2.0-flash-lite-001',
        'google/gemini-pro', 'google/gemini-pro-vision',
        'google/gemini-flash-1.5', 'google/gemini-flash-1.5-8b',
        // Mistral
        'mistralai/mistral-large-2411', 'mistralai/mistral-medium',
        'mistralai/mistral-small-3.1-24b-instruct',
        'mistralai/mixtral-8x7b-instruct', 'mistralai/mixtral-8x22b-instruct',
        'mistralai/mistral-7b-instruct', 'mistralai/codestral-2501',
        'mistralai/pixtral-large-2411', 'mistralai/pixtral-12b',
        'mistralai/mistral-nemo',
        // Qwen
        'qwen/qwen-2.5-72b-instruct', 'qwen/qwen-2.5-32b-instruct',
        'qwen/qwen-2.5-coder-32b-instruct', 'qwen/qwen-2.5-7b-instruct',
        'qwen/qwen-2-72b-instruct', 'qwen/qwen-2-vl-72b-instruct',
        'qwen/qwq-32b', 'qwen/qwen3-235b-a22b',
        'qwen/qwen3-30b-a3b', 'qwen/qwen3-32b', 'qwen/qwen3-14b', 'qwen/qwen3-8b',
        // DeepSeek
        'deepseek/deepseek-chat-v3-0324', 'deepseek/deepseek-r1',
        'deepseek/deepseek-r1-distill-llama-70b', 'deepseek/deepseek-r1-distill-qwen-32b',
        'deepseek/deepseek-v3-base', 'deepseek/deepseek-prover-v2',
        // Cohere
        'cohere/command-r-plus', 'cohere/command-r', 'cohere/command-a',
        // Perplexity
        'perplexity/sonar-pro', 'perplexity/sonar', 'perplexity/sonar-reasoning-pro',
        'perplexity/sonar-deep-research',
        // Microsoft
        'microsoft/phi-4', 'microsoft/phi-4-multimodal-instruct',
        'microsoft/phi-3.5-mini-128k-instruct', 'microsoft/phi-3-medium-128k-instruct',
        'microsoft/wizardlm-2-8x22b', 'microsoft/mai-ds-r1',
        // NousResearch
        'nousresearch/hermes-3-llama-3.1-405b', 'nousresearch/hermes-2-pro-llama-3-8b',
        'nousresearch/nous-capybara-34b',
        // x.ai
        'x-ai/grok-3-beta', 'x-ai/grok-3-mini-beta',
        'x-ai/grok-2-1212', 'x-ai/grok-2-vision-1212',
        // Amazon
        'amazon/nova-pro-v1', 'amazon/nova-lite-v1', 'amazon/nova-micro-v1',
        // NVIDIA
        'nvidia/llama-3.1-nemotron-70b-instruct',
        // 01.ai
        '01-ai/yi-large',
        // Databricks
        'databricks/dbrx-instruct',
        // Modelos gratuitos
        'meta-llama/llama-3.1-8b-instruct:free', 'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen-2.5-7b-instruct:free', 'qwen/qwen3-8b:free',
        'google/gemma-2-9b-it:free', 'google/gemma-3-27b-it:free',
        'mistralai/mistral-7b-instruct:free',
        'huggingfaceh4/zephyr-7b-beta:free',
        'openchat/openchat-7b:free',
        'deepseek/deepseek-r1:free', 'deepseek/deepseek-chat-v3-0324:free',
        'microsoft/phi-3-mini-128k-instruct:free',
        'nousresearch/nous-capybara-7b:free',
      ],
    },
    {
      name: 'Ollama (local)',
      slug: 'ollama',
      description: 'Modelos locais via Ollama — sem custo, rodando na sua máquina.',
      models: [
        'llama3.1:405b', 'llama3.1:70b', 'llama3.1:8b',
        'llama3.2:3b', 'llama3.2:1b', 'llama3.2-vision:11b', 'llama3.2-vision:90b',
        'llama3.3:70b',
        'gemma2:27b', 'gemma2:9b', 'gemma2:2b', 'gemma3:27b', 'gemma3:12b', 'gemma3:4b', 'gemma3:1b',
        'qwen2.5:72b', 'qwen2.5:32b', 'qwen2.5:14b', 'qwen2.5:7b', 'qwen2.5:3b', 'qwen2.5:1.5b', 'qwen2.5:0.5b',
        'qwen2.5-coder:32b', 'qwen2.5-coder:14b', 'qwen2.5-coder:7b',
        'qwen3:235b-a22b', 'qwen3:30b-a3b', 'qwen3:32b', 'qwen3:14b', 'qwen3:8b', 'qwen3:4b',
        'mistral:7b', 'mistral-nemo:12b', 'mistral-small:24b', 'mistral-large:123b',
        'mixtral:8x7b', 'mixtral:8x22b',
        'phi4:14b', 'phi3.5:3.8b', 'phi3:14b', 'phi3:3.8b',
        'deepseek-r1:70b', 'deepseek-r1:32b', 'deepseek-r1:14b', 'deepseek-r1:8b', 'deepseek-r1:1.5b',
        'deepseek-v3:671b',
        'codellama:70b', 'codellama:34b', 'codellama:13b', 'codellama:7b',
        'command-r-plus:104b', 'command-r:35b',
        'starcoder2:15b', 'starcoder2:7b', 'starcoder2:3b',
        'nomic-embed-text', 'mxbai-embed-large', 'all-minilm',
        'llava:34b', 'llava:13b', 'llava:7b',
        'moondream:1.8b',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-mute">
        Gerencie seu catálogo pessoal de modelos. Cada provedor mostra <strong>todos</strong> os modelos disponíveis — sem limite.
        Selecione os que deseja utilizar.
      </p>
      {providers.map((p) => (
        <details key={p.slug} className="group">
          <summary className="cursor-pointer flex items-center justify-between py-3 px-4 rounded-lg hover:bg-surfaceAlt transition">
            <div>
              <span className="font-medium">{p.name}</span>
              <span className="text-mute text-sm ml-2">({p.models.length} modelos)</span>
            </div>
            <span className="text-mute text-sm group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-2 px-4">
            <p className="text-sm text-mute mb-3">{p.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-80 overflow-y-auto">
              {p.models.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-surfaceAlt cursor-pointer">
                  <input type="checkbox" className="accent-accent" />
                  <span className="font-mono text-xs truncate">{m}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function TranscriptionProvidersInfo() {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-mute">
        Os provedores de transcrição convertem áudio em texto. Cada um tem características e custos diferentes.
        Você pode escolher qual provedor utilizar para cada agente de transcrição.
      </p>

      <div className="space-y-3">
        <div className="p-4 rounded-lg bg-surfaceAlt">
          <div className="font-medium">Groq — Whisper Large v3</div>
          <div className="text-mute mt-1">
            <strong>Velocidade:</strong> Extremamente rápido (até 25x mais rápido que tempo real) graças à inferência em LPU.
          </div>
          <div className="text-mute mt-1">
            <strong>Custo:</strong> Gratuito no tier free (limites de rate). Para uso intensivo, US$ 0,111/hora de áudio.
          </div>
          <div className="text-mute mt-1">
            <strong>Qualidade:</strong> Excelente para português e inglês. Suporta detecção automática de idioma.
          </div>
        </div>

        <div className="p-4 rounded-lg bg-surfaceAlt">
          <div className="font-medium">OpenAI — Whisper-1</div>
          <div className="text-mute mt-1">
            <strong>Velocidade:</strong> Rápido, mas mais lento que Groq. Tempo de processamento similar ao tempo real do áudio.
          </div>
          <div className="text-mute mt-1">
            <strong>Custo:</strong> US$ 0,006 por minuto de áudio (aproximadamente US$ 0,36/hora).
          </div>
          <div className="text-mute mt-1">
            <strong>Qualidade:</strong> Muito boa, especialmente para inglês. Suporta mais de 50 idiomas.
          </div>
        </div>

        <div className="p-4 rounded-lg bg-surfaceAlt">
          <div className="font-medium">Local — Faster Whisper (Self-host)</div>
          <div className="text-mute mt-1">
            <strong>Velocidade:</strong> Depende do hardware. Com GPU NVIDIA, pode ser mais rápido que tempo real.
          </div>
          <div className="text-mute mt-1">
            <strong>Custo:</strong> Gratuito — roda localmente na sua infraestrutura. Requer GPU para melhor desempenho.
          </div>
          <div className="text-mute mt-1">
            <strong>Qualidade:</strong> Idêntica ao Whisper original. Suporta diarização (identificação de falantes).
          </div>
          <div className="text-mute mt-1">
            <strong>Requisitos:</strong> Docker + GPU NVIDIA (recomendado) ou CPU. Configurável via <code className="font-mono bg-bg px-1 rounded">LOCAL_WHISPER_URL</code>.
          </div>
        </div>
      </div>

      <p className="text-mute text-xs mt-4">
        💡 Recomendação: Use <strong>Groq</strong> para melhor custo-benefício. Use <strong>Faster Whisper local</strong> se preferir não enviar dados para a nuvem.
      </p>
    </div>
  );
}
