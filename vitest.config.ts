import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['EVAL.{ts,tsx}', 'evals/**/EVAL.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    reporters: ['verbose'],
  },
});
