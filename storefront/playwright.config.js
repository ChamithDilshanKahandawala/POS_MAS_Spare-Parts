import { defineConfig } from '@playwright/test';

// Milestone 5 Part E — a throwaway dev server on its OWN port (5199, not
// 5174 — that port is the engagement's standing dev server and must
// never be touched/restarted). Started fresh for this test run only, so
// it picks up .env.development's VITE_DATA_SOURCE=marketplace even
// though the 5174 instance was started before that value existed.
export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    screenshot: 'on',
  },
  webServer: {
    command: 'npx vite --port 5199 --mode development --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
