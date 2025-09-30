/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: true,
  },
  images: {
    domains: ['localhost'],
  },
};

export default nextConfig;