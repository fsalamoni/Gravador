import { IntegrationCards } from './integration-cards';

export default function IntegrationsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold mb-2">Integrações</h1>
      <p className="text-mute text-sm mb-6">
        Conecte seus serviços favoritos ao Gravador para backup automático, sincronização e troca de
        áudios.
      </p>

      <h2 className="text-lg font-medium mb-3">Armazenamento e Backup</h2>
      <p className="text-mute text-sm mb-4">
        Configure backups automáticos das suas gravações e transcrições nos serviços de nuvem
        abaixo.
      </p>
      <IntegrationCards category="storage" />

      <h2 className="text-lg font-medium mt-10 mb-3">Mensageria</h2>
      <p className="text-mute text-sm mb-4">
        Envie e receba áudios diretamente pelo WhatsApp integrado ao Gravador.
      </p>
      <IntegrationCards category="messaging" />

      <h2 className="text-lg font-medium mt-10 mb-3">Produtividade</h2>
      <p className="text-mute text-sm mb-4">
        Envie resumos, ações e notas para seus aplicativos de produtividade.
      </p>
      <IntegrationCards category="productivity" />
    </div>
  );
}
