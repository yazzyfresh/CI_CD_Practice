import { defineConfig } from 'playwright/test';

// The packaged JAR cannot load profiles from src/test/resources.
// Its database settings are supplied explicitly to its Java process below.
const db = {
  SPRING_DATASOURCE_URL: process.env.CI_DB_URL,
  SPRING_DATASOURCE_USERNAME: process.env.CI_DB_USERNAME,
  SPRING_DATASOURCE_PASSWORD: process.env.CI_DB_PASSWORD,
};
// Allow test discovery/report viewing without a running database.
for (const key of Object.keys(db)) {
  if (db[key] === undefined) delete db[key];
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
    // Keep passing runs too, so students can watch their first full flow.
    video: 'on',
    trace: 'on',
    screenshot: 'on',
    launchOptions: { slowMo: 150 },
  },
  webServer: [
    {
      command: 'java -jar ../backend/target/banking-security-1.0.0.jar',
      url: 'http://127.0.0.1:8080/api/public/info',
      env: { ...db, SERVER_PORT: '8080', SPRING_JPA_HIBERNATE_DDL_AUTO: 'validate' },
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm --prefix ../frontend run preview -- --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
