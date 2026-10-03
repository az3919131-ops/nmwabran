import { defineConfig } from "@playwright/test";

const external = process.env.E2E_BASE_URL;           // مثال: http://localhost:5173 مع docker compose
const port = process.env.E2E_PORT || "3100";
const chromium = process.env.E2E_CHROMIUM;           // مسار Chromium جاهز (اختياري)

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: ".output",
  use: {
    baseURL: external || `http://127.0.0.1:${port}`,
    locale: "ar-SA",
    viewport: { width: 1360, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: chromium || undefined, args: ["--no-sandbox"] },
  },
  webServer: external ? undefined : {
    command: "node e2e/start-stack.mjs",
    cwd: "..",
    url: `http://127.0.0.1:${port}/api/v1/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
