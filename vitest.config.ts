import { defineConfig } from "vitest/config";
import { config as loadDotEnv } from "dotenv";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);
const dotenvResult = loadDotEnv({ path: path.resolve(templateRoot, ".env") });

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    env: dotenvResult.error ? {} : (dotenvResult.parsed ?? {}),
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
    ],
  },
});
