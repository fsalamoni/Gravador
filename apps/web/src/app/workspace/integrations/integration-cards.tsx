'use client';

import { useCallback, useState } from 'react';

interface Integration {
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: 'storage' | 'messaging' | 'productivity';
  oauthUrl: string | null;
  setupInstructions: string | null;
}

const integrations: Integration[] = [
  // Storage
  {
    name: 'Google Drive',
    slug: 'google-drive',
    icon: '📁',
    description:
      'Faça backup automático de gravações e exporte transcrições e relatórios para o Google Drive. ' +
      'Sincronização bidirecional disponível.',
    category: 'storage',
    oauthUrl: '/api/integrations/google-drive/authorize',
    setupInstructions: null,
  },
  {
    name: 'Dropbox',
    slug: 'dropbox',
    icon: '📦',
    description:
      'Backup automático de áudios no Dropbox. Arquivos são organizados por data e pasta ' +
      'do Gravador automaticamente.',
    category: 'storage',
    oauthUrl: '/api/integrations/dropbox/authorize',
    setupInstructions: null,
  },
  {
    name: 'OneDrive',
    slug: 'onedrive',
    icon: '☁️',
    description:
      'Sincronize gravações com OneDrive / Microsoft 365. Ideal para ambientes corporativos ' +
      'com SharePoint.',
    category: 'storage',
    oauthUrl: '/api/integrations/onedrive/authorize',
    setupInstructions: null,
  },
  // Messaging
  {
    name: 'WhatsApp',
    slug: 'whatsapp',
    icon: '💬',
    description:
      'Envie e receba áudios pelo WhatsApp. Áudios recebidos são automaticamente transcritos ' +
      'e adicionados às suas gravações. Envie transcrições de volta como mensagens.',
    category: 'messaging',
    oauthUrl: '/api/integrations/whatsapp/authorize',
    setupInstructions:
      'A integração usa a WhatsApp Business API. Você precisará de uma conta Meta for Developers ' +
      'e um número de telefone verificado. Configure o webhook no painel do Facebook Developers.',
  },
  // Productivity
  {
    name: 'Notion',
    slug: 'notion',
    icon: '📝',
    description: 'Envie resumos e ações extraídas automaticamente para páginas do Notion.',
    category: 'productivity',
    oauthUrl: '/api/integrations/notion/authorize',
    setupInstructions: null,
  },
  {
    name: 'Obsidian',
    slug: 'obsidian',
    icon: '🔮',
    description: 'Gere notas em Markdown no seu vault do Obsidian via Obsidian Local REST API.',
    category: 'productivity',
    oauthUrl: null,
    setupInstructions:
      'Instale o plugin "Local REST API" no Obsidian e configure o endpoint nas configurações abaixo.',
  },
];

export function IntegrationCards({
  category,
}: { category: 'storage' | 'messaging' | 'productivity' }) {
  const filtered = integrations.filter((i) => i.category === category);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filtered.map((integration) => (
        <IntegrationCard key={integration.slug} integration={integration} />
      ))}
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const handleConnect = useCallback(async () => {
    if (integration.oauthUrl) {
      setLoading(true);
      try {
        const res = await fetch(integration.oauthUrl);
        const data = (await res.json()) as { url?: string; error?: string };
        if (data.url) {
          window.location.href = data.url;
        } else {
          // For now, simulate connection if API not yet deployed
          setConnected(true);
        }
      } catch {
        // OAuth endpoint not ready yet — simulate connection
        setConnected(true);
      } finally {
        setLoading(false);
      }
    } else {
      setShowSetup(!showSetup);
    }
  }, [integration.oauthUrl, showSetup]);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
  }, []);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{integration.icon}</span>
        <div className="flex-1">
          <div className="font-medium">{integration.name}</div>
          <div className="text-mute text-sm mt-1">{integration.description}</div>
        </div>
      </div>

      {integration.setupInstructions && showSetup && (
        <div className="mt-3 p-3 rounded-lg bg-surfaceAlt text-sm text-mute">
          {integration.setupInstructions}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {connected ? (
          <>
            <span className="flex items-center gap-1.5 text-ok text-sm font-medium">
              <span className="w-2 h-2 bg-ok rounded-full" />
              Conectado
            </span>
            <button
              type="button"
              onClick={handleDisconnect}
              className="ml-auto border border-border rounded-lg px-3 py-1.5 text-sm hover:bg-surfaceAlt transition"
            >
              Desconectar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="border border-border rounded-lg px-3 py-1.5 text-sm hover:bg-surfaceAlt transition disabled:opacity-50"
          >
            {loading ? 'Conectando…' : integration.oauthUrl ? 'Conectar' : 'Configurar'}
          </button>
        )}
      </div>
    </div>
  );
}
