/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.nexura.intuition.box",
    NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1452214561238286419",
  },
  eslint: {
    // Foundation phase: don't fail the build on lint while pages are still being ported.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    // @coinbase/cdp-sdk (transitive dep of @base-org/account via wagmi/rainbowkit)
    // statically imports @x402/* packages that are declared as OPTIONAL peer
    // dependencies, so they are never installed. Alias them to empty modules so
    // webpack doesn't fail the build tracing them — the x402 payment paths are
    // unused in this app.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/extensions": false,
      "@x402/svm": false,
      "@x402/svm/exact/client": false,
    };
    return config;
  },
};

export default nextConfig;
