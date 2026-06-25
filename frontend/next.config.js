/** @type {import('next').NextConfig} */

// When the app is reached over a public tunnel, the browser only talks to the
// frontend origin; Next proxies API + uploaded-file requests to the backend
// (default localhost:3001). Set BACKEND_ORIGIN to point elsewhere if needed.
const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:3001';

// Verification/CI builds must NEVER write into the dev server's `.next`, or
// they corrupt the live dev state (BUILD_ID + prerender-manifest break HMR /
// Tailwind). Build-verify runs set NEXT_DISTDIR=.next-verify; `next dev` keeps
// the default `.next`. The two must never share a directory.
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DISTDIR || '.next',
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${BACKEND}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND}/uploads/:path*` },
    ];
  },
  // ScripON → ScriptON route rename: keep old links/bookmarks working.
  async redirects() {
    return [
      { source: '/scripon', destination: '/scripton', permanent: true },
      { source: '/scripon/:path*', destination: '/scripton/:path*', permanent: true },
    ];
  },
};

module.exports = nextConfig;
