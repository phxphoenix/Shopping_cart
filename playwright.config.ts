import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_PATH = process.env.VITE_BASE_PATH ?? '/';
const normalizedBasePath = BASE_PATH.endsWith('/') ? BASE_PATH : `${BASE_PATH}/`;
const BASE_URL = `http://localhost:${PORT}${normalizedBasePath}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm.cmd run build && npm.cmd run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ADMIN_PASSWORD: 'admin123',
      ALLOW_DEFAULT_ADMIN_PASSWORD: 'true',
    },
  },
});
