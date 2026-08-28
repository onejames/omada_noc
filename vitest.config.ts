import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'lib/**/*.ts',
        'app/components/**/*.tsx',
        'app/api/**/*.ts',
        'app/page.tsx',
        'mcp/server.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/types/**',
        'node_modules/**',
        '.next/**',
        'app/layout.tsx',
        'scripts/**',
        'mcp/cli.ts',
      ],
      thresholds: {
        lines: 97,
        functions: 97,
        statements: 97,
      },
    },
  },
});
