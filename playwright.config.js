// @ts-check
const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  workers: 4,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: { launchOptions: { executablePath: "/usr/bin/google-chrome" } },
});
