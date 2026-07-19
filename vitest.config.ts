import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["test/e2e/**"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/extension.ts", "src/**/interface/**"],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve("./test/__mocks__/vscode"),
    },
  },
});
