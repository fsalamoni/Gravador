import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gravador/core', '@gravador/db', '@gravador/ai', '@gravador/i18n'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'reactflow'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
};

export default withNextIntl(config);
