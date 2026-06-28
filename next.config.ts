import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // We live inside a folder that has a parent lockfile; pin the workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
