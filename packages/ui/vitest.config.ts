import path from "node:path";
import { defineConfig } from "vitest/config";

const sharedRoot = path.resolve(__dirname, "../shared/src");

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@bros2/shared": path.join(sharedRoot, "index.ts")
    }
  }
});
