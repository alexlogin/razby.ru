/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@razby/shared'],
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [];
  },
};

export default nextConfig;
