/** @type {import('next').NextConfig} */
/* global URL */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
