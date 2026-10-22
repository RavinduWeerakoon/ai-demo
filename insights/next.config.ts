import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the container image (see Dockerfile).
  output: "standalone",
  experimental: {
    serverActions: {
      // Served through a CDN front end and the cluster gateway; allow the public
      // host in the server-action CSRF (Origin vs Host) check.
      allowedOrigins: ["insights.agents.agent-manager.wso2demos.com"],
    },
  },
  cacheComponents: true,
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
