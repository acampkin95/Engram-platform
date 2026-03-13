import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const coverageVisibilityMode = process.env.VITEST_COVERAGE_VISIBILITY === 'true';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: coverageVisibilityMode
      ? ['node_modules', 'e2e', 'app/dashboard/memory/graph/MemoryGraphContent.test.tsx']
      : ['node_modules', 'e2e'],
    fileParallelism: !coverageVisibilityMode,
    pool: coverageVisibilityMode ? 'threads' : 'forks',
    maxWorkers: coverageVisibilityMode ? 1 : undefined,
    minWorkers: coverageVisibilityMode ? 1 : undefined,
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
      thresholds: coverageVisibilityMode
        ? undefined
        : {
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
