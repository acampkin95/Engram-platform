import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/hooks/**/*.{ts,tsx}',
        'src/stores/**/*.{ts,tsx}',
        'src/design-system/components/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/config/**/*.{ts,tsx}',
        'src/providers/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.types.ts',
        'src/**/__tests__/**',
        'src/test/**',
        'src/components/ui/**',
        'src/components/DraggableGrid.tsx',
        'src/components/FilterBar.tsx',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
