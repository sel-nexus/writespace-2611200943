/** Run browser journeys against a fresh production bundle, not Vite development. */
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const configuredHost = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const configuredPort = process.env.PLAYWRIGHT_PORT || '4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${configuredHost}:${configuredPort}`;
const origin = new URL(baseURL);
if (origin.protocol !== 'http:' || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('PLAYWRIGHT_BASE_URL must be a local HTTP origin without a path or query.');
}
const port = Number(origin.port || 80);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PLAYWRIGHT_PORT must be an integer between 1 and 65535.');
}
const isCI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad Mini'], defaultBrowserType: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js build && node scripts/serve.js',
    url: baseURL,
    env: { HOST: origin.hostname, PORT: String(port) },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
