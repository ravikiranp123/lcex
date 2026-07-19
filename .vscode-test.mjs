import { defineConfig } from "@vscode/test-cli";

export default defineConfig([
  {
    label: "extension",
    files: "out-e2e/**/*.test.js",
    extensionDevelopmentPath: ".",
    workspaceFolder: "./test/fixtures/sample-workspace",
    launchArgs: [
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-dev-shm-usage",
    ],
    mocha: {
      ui: "bdd",
      timeout: 30_000,
    },
  },
]);
