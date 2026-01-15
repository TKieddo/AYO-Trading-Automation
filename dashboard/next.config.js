/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
      },
    ],
  },
  async rewrites() {
    // Only rewrite in development - in production, use environment variable
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/agent/:path*',
          destination: 'http://127.0.0.1:3000/:path*',
        },
      ];
    }
    // In production, API calls should go to your backend URL
    return [];
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
};

module.exports = nextConfig;

