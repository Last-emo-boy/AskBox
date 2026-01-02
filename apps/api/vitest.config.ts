import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.d.ts',
        'prisma/',
      ],
    },
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
