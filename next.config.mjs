const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;