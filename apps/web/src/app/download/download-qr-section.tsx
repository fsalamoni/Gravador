'use client';

import { QRCode } from '@/components/qr-code';

interface DownloadQRSectionProps {
  androidUrl: string | null;
  webAppUrl: string;
}

export function DownloadQRSection({ androidUrl, webAppUrl }: DownloadQRSectionProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {/* Android QR Code */}
      <div className="card p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-mute">Android</p>
            <h3 className="mt-2 text-xl font-semibold text-text">Escaneie para instalar o APK</h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              androidUrl ? 'bg-ok/15 text-ok' : 'bg-accent/15 text-accent'
            }`}
          >
            {androidUrl ? 'Disponível' : 'Em preparação'}
          </span>
        </div>
        <div className="mt-5 flex flex-col items-center gap-4">
          <div className="rounded-[20px] border border-border bg-white p-4">
            <QRCode value={androidUrl ?? webAppUrl} size={180} className="rounded-[12px]" />
          </div>
          <p className="max-w-xs text-center text-sm text-mute">
            {androidUrl
              ? 'Aponte a câmera do seu celular para o QR code acima para baixar e instalar o aplicativo Android.'
              : 'O APK ainda não está disponível. O QR code direciona para a versão web, que funciona como PWA no celular.'}
          </p>
        </div>
        <div className="mt-4 rounded-[16px] border border-border bg-bg/55 px-4 py-3 text-xs leading-5 text-mute">
          <strong className="text-text">Requisitos:</strong> Android 8.0+ • Ative &quot;Fontes
          desconhecidas&quot; nas configurações • 50MB de espaço livre
        </div>
      </div>

      {/* iOS QR Code */}
      <div className="card p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-mute">iOS</p>
            <h3 className="mt-2 text-xl font-semibold text-text">Apple iPhone &amp; iPad</h3>
          </div>
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            Em construção
          </span>
        </div>
        <div className="mt-5 flex flex-col items-center gap-4">
          <div className="relative rounded-[20px] border border-border bg-white p-4">
            <QRCode value={webAppUrl} size={180} className="rounded-[12px] opacity-30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-[16px] bg-surface/90 px-5 py-3 text-center shadow-lg backdrop-blur-sm">
                <p className="text-sm font-semibold text-text">🚧 Em construção</p>
                <p className="mt-1 text-xs text-mute">Em breve na App Store</p>
              </div>
            </div>
          </div>
          <p className="max-w-xs text-center text-sm text-mute">
            O aplicativo para iOS está em desenvolvimento. Enquanto isso, você pode acessar a
            plataforma pelo navegador Safari no seu iPhone ou iPad.
          </p>
        </div>
        <div className="mt-4 rounded-[16px] border border-border bg-bg/55 px-4 py-3 text-xs leading-5 text-mute">
          <strong className="text-text">Previsão:</strong> A versão iOS será distribuída via
          TestFlight inicialmente e depois na App Store quando aprovada pela Apple.
        </div>
      </div>
    </section>
  );
}
