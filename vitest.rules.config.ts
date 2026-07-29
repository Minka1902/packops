import { defineConfig } from 'vitest/config';

// Dedicated config for the Firestore rules emulator matrix. Run through the
// emulator: `npm run test:rules` (firebase emulators:exec). Requires the dev
// dependency @firebase/rules-unit-testing and a Java runtime for the emulator.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/rules-tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
