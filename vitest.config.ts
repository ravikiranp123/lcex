import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/extension.ts", "src/**/interface/**"],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve("./node_modules/vscode"),
    },
  },
});
