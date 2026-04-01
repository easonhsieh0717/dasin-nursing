import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: pkg.version,
  },
  experimental: {
    optimizePackageImports: ['recharts'],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/api/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/api/cases',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' },
        ],
      },
      {
        source: '/api/records',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;
