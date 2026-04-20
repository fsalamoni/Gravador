import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const buildOutput = process.env.NEXT_BUILD_OUTPUT === 'standalone' ? 'standalone' : undefined;

const config: NextConfig = {
  ...(buildOutput ? { output: buildOutput } : {}),
  reactStrictMode: true,
  transpilePackages: ['@gravador/core', '@gravador/db', '@gravador/ai', '@gravador/i18n'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'reactflow'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleapis.com' },
      { protocol: 'https', hostname: '**.firebasestorage.app' },
    ],
  },
};

export default withNextIntl(config);
