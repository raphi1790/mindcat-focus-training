import { defineConfig } from 'vitest/config';

/**
 * Separater Vitest-Lauf für den E2E-Lifecycle-Datenbanktest (Issue #17).
 * Führt den vollständigen Längsschnitt-Lebenszyklus gegen den Firestore-Emulator aus.
 * Ausführen über `npm run test:e2e` (startet den Emulator via `firebase emulators:exec`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/validation/e2eLifecycle.test.ts'],
    // Emulator-Zustand wird geteilt → serielle Ausführung der Testdateien.
    fileParallelism: false,
  },
});
