import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/types/**/*.ts',
        'src/infrastructure/**/*.ts',
        'src/components/dashboard/**/*.tsx',
        'src/components/layout/**/*.tsx',
        'src/app/(dashboard)/**/*.tsx',
      ],
      exclude: [
        'src/components/ui/**',
        'src/**/*.test.*',
        'src/__tests__/**',
      ],
      thresholds: {
        statements: 98,
        branches: 95,
        functions: 98,
        lines: 98,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
