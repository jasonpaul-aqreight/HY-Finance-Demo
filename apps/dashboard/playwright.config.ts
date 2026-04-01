import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- -p 3000',
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: true,
  },
});
