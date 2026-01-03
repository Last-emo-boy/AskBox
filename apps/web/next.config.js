/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@askbox/crypto', '@askbox/shared-types'],
  experimental: {
    serverComponentsExternalPackages: ['libsodium-wrappers-sumo'],
  },
};

module.exports = nextConfig;
