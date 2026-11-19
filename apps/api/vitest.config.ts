import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/env.js';

export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    },
    // All test files share one database.
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
