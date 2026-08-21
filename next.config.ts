import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root — the parent directory holds an unrelated
    // package-lock.json that Turbopack would otherwise try to adopt.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
