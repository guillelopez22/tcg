/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        // TCGPlayer CDN for card art
        protocol: 'https',
        hostname: 'product-images.tcgplayer.com',
      },
      {
        protocol: 'https',
        hostname: '**.tcgplayer.com',
      },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
    return [
      {
        source: '/api/trpc/:path*',
        destination: `${apiUrl}/trpc/:path*`,
      },
    ];
  },
};

export default nextConfig;
