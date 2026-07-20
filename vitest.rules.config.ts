import { defineConfig } from 'vitest/config';

/**
 * Separater Vitest-Lauf für die Firestore-Rules-Tests (Plan §9 Phase 6).
 * Diese Tests brauchen einen laufenden Firestore-Emulator und werden daher
 * nicht vom Standard-`npm test` (include: src/**) erfasst, sondern nur über
 * `npm run test:rules` (via `firebase emulators:exec`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Rules-Tests teilen einen Emulator-Zustand → nicht parallelisieren.
    fileParallelism: false,
  },
});
