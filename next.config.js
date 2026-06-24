const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      allowedOrigins: ['hethongsub.vn', 'localhost:3000', 'localhost:3020'],
    },
  },
};

module.exports = nextConfig;
