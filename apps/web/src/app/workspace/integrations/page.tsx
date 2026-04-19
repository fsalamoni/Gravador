import { Cloud, Link2, Sparkles } from 'lucide-react';

export default function IntegrationsPage() {
  const items = [
    { name: 'Google Drive', slug: 'google-drive', description: 'Exportar gravações e relatórios.' },
    { name: 'Dropbox', slug: 'dropbox', description: 'Backup automático de áudios.' },
    { name: 'OneDrive', slug: 'onedrive', description: 'Sincronização com Microsoft 365.' },
    { name: 'Notion', slug: 'notion', description: 'Enviar resumos e ações direto ao Notion.' },
    { name: 'Obsidian', slug: 'obsidian', description: 'Gerar notas em Markdown no seu vault.' },
  ];
  return (
    <div className="space-y-5">
      <section className="card px-6 py-7 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow">Delivery layer</span>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">Integrações e destinos</h1>
            <p className="mt-4 max-w-3xl leading-8 text-mute">
              O workspace também precisa parecer pronto para exportar, automatizar e distribuir
              valor, não só armazenar áudio bruto.
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-bg/55 px-5 py-4 text-sm text-mute">
            Conectores para backup, documentação e distribuição operacional.
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <div key={i.slug} className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-mute">
                Connector
              </span>
              {i.slug === 'notion' || i.slug === 'obsidian' ? (
                <Sparkles className="h-5 w-5 text-accent" />
              ) : i.slug === 'google-drive' ? (
                <Cloud className="h-5 w-5 text-ok" />
              ) : (
                <Link2 className="h-5 w-5 text-accentSoft" />
              )}
            </div>
            <div className="mt-5 text-2xl font-semibold text-text">{i.name}</div>
            <div className="mt-3 text-sm leading-7 text-mute">{i.description}</div>
            <button
              type="button"
              className="mt-6 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2 text-sm font-semibold transition hover:text-text"
            >
              Conectar
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
