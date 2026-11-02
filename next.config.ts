import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the project root: a stray lockfile in a parent directory must not change it.
    root: path.join(__dirname),
  },
};

export default nextConfig;
