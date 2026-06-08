/** @type {import('next').NextConfig} */

// When the app is reached over a public tunnel, the browser only talks to the
// frontend origin; Next proxies API + uploaded-file requests to the backend
// (default localhost:3001). Set BACKEND_ORIGIN to point elsewhere if needed.
const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${BACKEND}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND}/uploads/:path*` },
    ];
  },
};

module.exports = nextConfig;
