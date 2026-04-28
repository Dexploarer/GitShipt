import { defineConfig, devices } from "@playwright/test";

const configuredBaseURL =
  [process.env.E2E_BASE_URL, process.env.PLAYWRIGHT_BASE_URL]
    .find((url): url is string => Boolean(url?.trim()))
    ?.trim();
const serverPort = process.env.E2E_PORT?.trim() || "3100";
const baseURL =
  configuredBaseURL ?? `http://127.0.0.1:${serverPort}`;
const webServer = configuredBaseURL
  ? undefined
  : {
      command: `NODE_ENV=production bun --env-file=../../.env.local run build && NODE_ENV=production bun --env-file=../../.env.local run start -- --hostname 127.0.0.1 --port ${serverPort}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    };

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  ...(webServer ? { webServer } : {}),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
