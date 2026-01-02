/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@askbox/crypto', '@askbox/shared-types'],
  experimental: {
    serverComponentsExternalPackages: ['libsodium-wrappers-sumo'],
  },
};

module.exports = nextConfig;
