import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default environment for backend/Node tests
    environment: 'node',
    environmentMatchGlobs: [
      // Use jsdom for all tests in public/ (browser-side modules)
      ['**/public/**/*.test.js', 'jsdom'],
    ],
  },
});
