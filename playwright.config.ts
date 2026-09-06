import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3100" },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start:web -- --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
      },
  reporter: "list",
});
