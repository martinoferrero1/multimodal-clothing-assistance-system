import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:8082",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run web -- --port 8082 --clear",
    env: { LOOKEATE_UI_TEST: "1" },
    url: "http://localhost:8082",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
