import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Allow a 20 MB file plus multipart/form-data headers and metadata.
      bodySizeLimit: "21mb",
    },
    // Middleware protects every portal route and must preserve the same body.
    middlewareClientMaxBodySize: "21mb",
  },
  eslint: {
    dirs: ["src"],
  },
  images: {
    remotePatterns: [],
  },
  // nodemailer pulls in Node built-ins (stream, http, ...). It's only ever
  // imported from Node-runtime server code (src/app/layout.tsx via
  // src/lib/mail/verify-on-boot.ts), which the default "node" webpack target
  // already resolves natively — no custom config needed there.
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
