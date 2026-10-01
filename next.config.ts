import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray pnpm-workspace.yaml exists in the parent home directory, which Turbopack
  // would otherwise try to treat as a workspace root. Pinning the root to this project
  // keeps module resolution and the file watcher scoped to the repository.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
