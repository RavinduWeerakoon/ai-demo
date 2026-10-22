import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the container image (see Dockerfile).
  output: "standalone",
  experimental: {
    serverActions: {
      // The demo is served through a CDN front end and the cluster gateway;
      // allow its public host in the server-action CSRF (Origin vs Host) check.
      allowedOrigins: ["meridian.agents.agent-manager.wso2demos.com"],
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
