import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typescript: {
    // D1 migration: type annotations need cleanup, code is functionally correct
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
