import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5127",
    launchOptions: process.env.CHROME_BIN
      ? {
          executablePath: process.env.CHROME_BIN,
          args: [
            "--no-sandbox",
            "--no-zygote",
            "--disable-dev-shm-usage",
          ],
        }
      : {},
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 5127 --strictPort",
    url: "http://127.0.0.1:5127",
    reuseExistingServer: false,
  },
});
