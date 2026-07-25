import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ["src"],
  },
  images: {
    remotePatterns: [],
  },
  // nodemailer pulls in Node built-ins (stream, http, ...) that trip up
  // webpack's bundling for the instrumentation/edge graph — treat it as a
  // plain runtime require instead of bundling it.
  serverExternalPackages: ["nodemailer"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        { "fs/promises": "commonjs fs/promises" },
        { fs: "commonjs fs" },
        { path: "commonjs path" },
        { crypto: "commonjs crypto" },
        // Node builtins nodemailer needs — only ever reached via the
        // NEXT_RUNTIME==="nodejs" guard in instrumentation.ts, but webpack
        // still needs to resolve the import graph at build time.
        { stream: "commonjs stream" },
        { http: "commonjs http" },
        { https: "commonjs https" },
        { net: "commonjs net" },
        { tls: "commonjs tls" },
        { dns: "commonjs dns" },
        { os: "commonjs os" },
        { zlib: "commonjs zlib" },
        { child_process: "commonjs child_process" },
      ];
    }
    return config;
  },
};

export default nextConfig;
