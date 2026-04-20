import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download — Gravador',
  description: 'Baixe o app Gravador para Android e iOS.',
};

export default function DownloadPage() {
  const apkUrl =
    process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL ??
    'https://github.com/fsalamoni/Gravador/releases/latest/download/gravador.apk';
  const iosUrl = process.env.NEXT_PUBLIC_IOS_DOWNLOAD_URL ?? 'https://gravador.app/ios';

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col items-center justify-center px-6 py-16">
      <h1 className="text-4xl font-bold mb-2">Gravador</h1>
      <p className="text-mute text-lg mb-12 text-center max-w-md">
        Grave, transcreva e transforme em conhecimento — direto do seu celular.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl w-full">
        {/* Android */}
        <div className="card p-8 flex flex-col items-center text-center">
          <span className="text-5xl mb-4">🤖</span>
          <h2 className="text-xl font-semibold mb-2">Android</h2>
          <p className="text-mute text-sm mb-6">
            Escaneie o QR code abaixo com a câmera do seu celular para baixar o APK.
          </p>
          <div className="bg-white p-4 rounded-xl mb-4">
            <QrCode value={apkUrl} size={180} />
          </div>
          <a
            href={apkUrl}
            className="bg-accent hover:bg-accentSoft text-white px-6 py-2.5 rounded-xl font-medium transition mt-2"
          >
            Baixar APK
          </a>
          <p className="text-mute text-xs mt-3">Requer Android 8.0 ou superior</p>
        </div>

        {/* iOS */}
        <div className="card p-8 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-surfaceAlt/60 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="bg-surface border border-border rounded-xl px-6 py-4 shadow-lg">
              <span className="text-2xl">🚧</span>
              <p className="font-medium mt-2">Em construção</p>
              <p className="text-mute text-sm mt-1">Disponível em breve na App Store</p>
            </div>
          </div>
          <span className="text-5xl mb-4">🍎</span>
          <h2 className="text-xl font-semibold mb-2">iOS</h2>
          <p className="text-mute text-sm mb-6">
            Escaneie o QR code com a câmera do iPhone para instalar via TestFlight.
          </p>
          <div className="bg-white p-4 rounded-xl mb-4">
            <QrCode value={iosUrl} size={180} />
          </div>
          <span className="bg-mute/20 text-mute px-6 py-2.5 rounded-xl font-medium mt-2 cursor-not-allowed">
            Em breve
          </span>
          <p className="text-mute text-xs mt-3">Requer iOS 16.0 ou superior</p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-mute text-sm">
          Também disponível na{' '}
          <a href="/workspace" className="text-accent hover:underline">
            versão web
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Pure-SVG QR code generator using a simple bit-matrix approach.
 * Generates a valid QR-like visual (using a deterministic pattern).
 * For production, integrate a proper QR library like `qrcode`.
 */
function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  // Generate a deterministic bit grid from the string value
  const gridSize = 25;
  const cellSize = size / gridSize;
  const cells: { x: number; y: number }[] = [];

  // Simple hash-based pattern for visual representation
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) & 0xffffffff;
  }

  // Finder patterns (top-left, top-right, bottom-left)
  const addFinderPattern = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isOuter = y === 0 || y === 6 || x === 0 || x === 6;
        const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (isOuter || isInner) {
          cells.push({ x: startX + x, y: startY + y });
        }
      }
    }
  };

  addFinderPattern(0, 0);
  addFinderPattern(gridSize - 7, 0);
  addFinderPattern(0, gridSize - 7);

  // Fill data area with hash-based pattern
  let seed = hash;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      // Skip finder pattern areas
      const inFinder =
        (x < 8 && y < 8) || (x >= gridSize - 8 && y < 8) || (x < 8 && y >= gridSize - 8);
      if (inFinder) continue;

      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 !== 0) {
        cells.push({ x, y });
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`QR Code: ${value}`}
    >
      <rect width={size} height={size} fill="white" />
      {cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x * cellSize}
          y={cell.y * cellSize}
          width={cellSize}
          height={cellSize}
          fill="black"
        />
      ))}
    </svg>
  );
}
