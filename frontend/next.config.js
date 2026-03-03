/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // Les requêtes /api/* du navigateur sont proxiées vers le backend
    // Cela élimine les erreurs Mixed Content (même origine = même protocole)
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
