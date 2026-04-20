'use client';

import QR from 'qrcode';
import { useEffect, useRef } from 'react';

/**
 * Real QR code renderer backed by the `qrcode` library. Encodes `value` into a
 * scannable QR matrix and paints it into a canvas on mount.
 */
interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 200, className }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QR.toCanvas(canvas, value || ' ', {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(() => {
      // swallow — rendering errors shouldn't crash the page
    });
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
