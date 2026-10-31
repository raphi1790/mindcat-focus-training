import { describe, expect, it } from 'vitest';
import { getEnv, getFirebaseConfig } from './index';

describe('src/env — Zentrales Environment-Handling', () => {
  it('liest gesetzte Umgebungsvariablen aus', () => {
    const mockEnv = { VITE_FIREBASE_PROJECT_ID: 'mindcat-focus-training-qual' };
    expect(getEnv('VITE_FIREBASE_PROJECT_ID', mockEnv)).toBe('mindcat-focus-training-qual');
  });

  it('gibt undefined für nicht gesetzte oder leere Variablen zurück', () => {
    const mockEnv = { VITE_EMPTY: '' };
    expect(getEnv('VITE_EMPTY', mockEnv)).toBeUndefined();
    expect(getEnv('VITE_MISSING', mockEnv)).toBeUndefined();
  });

  it('liefert ein vollständiges FirebaseConfig-Objekt', () => {
    const config = getFirebaseConfig({
      VITE_FIREBASE_API_KEY: 'test-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_STORAGE_BUCKET: 'test.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '12345',
      VITE_FIREBASE_APP_ID: '1:12345:web:abc',
    });
    expect(config).toEqual({
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.firebasestorage.app',
      messagingSenderId: '12345',
      appId: '1:12345:web:abc',
    });
  });
});
