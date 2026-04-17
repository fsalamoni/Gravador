export default function IntegrationsPage() {
  const items = [
    { name: 'Google Drive', slug: 'google-drive', description: 'Exportar gravações e relatórios.' },
    { name: 'Dropbox', slug: 'dropbox', description: 'Backup automático de áudios.' },
    { name: 'OneDrive', slug: 'onedrive', description: 'Sincronização com Microsoft 365.' },
    { name: 'Notion', slug: 'notion', description: 'Enviar resumos e ações direto ao Notion.' },
    { name: 'Obsidian', slug: 'obsidian', description: 'Gerar notas em Markdown no seu vault.' },
  ];
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold mb-6">Integrações</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((i) => (
          <div key={i.slug} className="card p-5">
            <div className="font-medium">{i.name}</div>
            <div className="text-mute text-sm mt-1">{i.description}</div>
            <button
              type="button"
              className="mt-4 border border-border rounded-lg px-3 py-1.5 text-sm hover:bg-surfaceAlt"
            >
              Conectar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
