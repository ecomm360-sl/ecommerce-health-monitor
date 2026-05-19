const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;