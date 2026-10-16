import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// End-to-end tests run against TEST_DATABASE_URL, never the development database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is not set; see .env.example');

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test' },
    globalSetup: ['./test/global-setup.ts'],
    // Test files share one database.
    fileParallelism: false,
  },
});
