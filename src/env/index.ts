export interface FirebaseEnvConfig {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
}

type EnvRecord = Record<string, string | undefined>;

type GlobalWithProcess = typeof globalThis & {
  process?: {
    env?: EnvRecord;
  };
};

/**
 * Liest eine Umgebungsvariable plattformübergreifend aus:
 * - Im Browser / Vite-Build via `import.meta.env`
 * - In Node.js / CLI-Skripten via `globalThis.process.env`
 */
export function getEnv(key: string, source?: EnvRecord): string | undefined {
  if (source) {
    const val = source[key];
    return val !== undefined && val !== '' ? val : undefined;
  }
  const metaEnv = (import.meta as unknown as { env?: EnvRecord }).env;
  if (metaEnv && metaEnv[key] !== undefined && metaEnv[key] !== '') {
    return metaEnv[key];
  }
  const procEnv = (globalThis as GlobalWithProcess).process?.env;
  if (procEnv && procEnv[key] !== undefined && procEnv[key] !== '') {
    return procEnv[key];
  }
  return undefined;
}

export function getFirebaseConfig(source?: EnvRecord): FirebaseEnvConfig {
  return {
    apiKey: getEnv('VITE_FIREBASE_API_KEY', source),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', source),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID', source),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', source),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', source),
    appId: getEnv('VITE_FIREBASE_APP_ID', source),
  };
}
