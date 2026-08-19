/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a verification build write somewhere other than `.next`, so running
  // `next build` never clobbers the chunks a live `next dev` is still serving
  // (which shows up in the browser as a suddenly unstyled page).
  //   NEXT_DIST_DIR=.next-verify npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverComponentsExternalPackages: [
      "smartapi-javascript",
      "ws",
      "bufferutil",
      "utf-8-validate",
      "pg",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "ws",
        "bufferutil",
        "utf-8-validate",
      ];
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
