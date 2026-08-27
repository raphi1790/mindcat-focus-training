import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure Logik (Scoring, RNG, Schemas) läuft in Node; Komponenten-Tests
    // erhalten bei Bedarf ein jsdom-Environment per @vitest-environment-Pragma.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/validation/e2eLifecycle.test.ts', '**/node_modules/**', '**/dist/**'],
  },
});

