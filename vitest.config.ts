import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", DISABLE_RATE_LIMIT: "1" },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
