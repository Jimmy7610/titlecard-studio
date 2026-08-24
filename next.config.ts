import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this repository.
    //
    // Turbopack infers the root by walking upwards looking for a lockfile, so a
    // clone nested under another JavaScript project — a monorepo, or any folder
    // that happens to hold a package-lock.json — can have its root inferred
    // somewhere unhelpful. Pinning it makes the build depend on this directory
    // and nothing above it, which is what a clean clone needs.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
