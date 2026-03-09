import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Optimize package imports for tree-shaking
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@xyflow/react"],
  },
};

export default nextConfig;
