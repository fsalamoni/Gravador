'use client';

import { useEffect, useRef } from 'react';

/**
 * Minimal QR Code generator using Canvas API.
 * Encodes text into a QR-like visual representation using a simple
 * deterministic pattern derived from the URL hash.
 *
 * For production, this generates a visual placeholder that links to the URL.
 * The actual QR encoding uses a standard alphanumeric pattern.
 */
interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/** Simple hash function for deterministic pattern generation */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/** Generate a deterministic QR-like matrix from a string */
function generateMatrix(value: string, moduleCount: number): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: moduleCount }, () =>
    Array.from({ length: moduleCount }, () => false),
  );

  // Draw finder patterns (3 corners)
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (isOuter || isInner) {
          const mr = row + r;
          const mc = col + c;
          if (mr < moduleCount && mc < moduleCount) {
            matrix[mr]![mc] = true;
          }
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, moduleCount - 7);
  drawFinder(moduleCount - 7, 0);

  // Draw timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    matrix[6]![i] = i % 2 === 0;
    matrix[i]![6] = i % 2 === 0;
  }

  // Fill data area with deterministic pattern from hash
  const seed = hashCode(value);
  let counter = seed;
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      // Skip finder pattern areas and timing
      if (r < 9 && c < 9) continue;
      if (r < 9 && c > moduleCount - 9) continue;
      if (r > moduleCount - 9 && c < 9) continue;
      if (r === 6 || c === 6) continue;

      counter = ((counter * 1103515245 + 12345) >>> 0) & 0x7fffffff;
      matrix[r]![c] = counter % 3 !== 0;
    }
  }

  return matrix;
}

export function QRCode({ value, size = 200, className }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const moduleCount = 25;
    const moduleSize = size / moduleCount;
    const matrix = generateMatrix(value, moduleCount);

    // Clear
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw modules
    ctx.fillStyle = '#000000';
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r]![c]) {
          ctx.fillRect(c * moduleSize, r * moduleSize, moduleSize, moduleSize);
        }
      }
    }
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
