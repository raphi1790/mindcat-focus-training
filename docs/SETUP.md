# Setup: Firebase & lokale Entwicklung

## 1. Voraussetzungen

- Node.js ≥ 20, npm
- Firebase-CLI: `npm install -g firebase-tools`

## 2. Firebase-Projekt einrichten (einmalig)

1. [Firebase Console](https://console.firebase.google.com) → Projekt erstellen (z. B. `mindcat-focus-training`).
2. **Authentication** aktivieren: Build → Authentication → Sign-in method → **E-Mail/Passwort** und **Google** aktivieren.
3. **Firestore** anlegen: Build → Firestore Database → Datenbank erstellen (Region z. B. `europe-west6`, Produktionsmodus — die Rules kommen aus diesem Repo).
4. **Web-App registrieren:** Projekteinstellungen → Allgemein → Meine Apps → Web-App hinzufügen. Die angezeigte SDK-Konfiguration liefert die Werte für `.env`.

## 3. Lokale Konfiguration

```bash
cp .env.example .env      # dann die VITE_FIREBASE_*-Werte aus der Console eintragen
npm install
npm run dev
```

Ohne ausgefüllte `.env` verbindet die App nicht mit Firebase (Login schlägt fehl).

## 4. Security Rules deployen

Projekt-ID in `.firebaserc` eintragen (ersetzt `REPLACE-WITH-YOUR-FIREBASE-PROJECT-ID`), dann:

```bash
firebase login
firebase deploy --only firestore:rules
```

Die Rules binden alle Daten strikt an den eingeloggten Betreuer
(`users/{uid}/**`) und verbieten Update/Delete auf Messdaten
(`assessments`, `trainingSessions`) — wissenschaftliche Rohdaten sind append-only.

## 5. Emulator (empfohlen für Entwicklung & Rules-Tests)

```bash
firebase emulators:start
```

- Firestore: `localhost:8080`, Auth: `localhost:9099`, UI: `localhost:4000`

Um die App gegen den Emulator laufen zu lassen, in `src/services/firebase.js`
(bzw. der TS-Nachfolgedatei) `connectFirestoreEmulator`/`connectAuthEmulator`
hinter einer `import.meta.env.DEV`-Prüfung aktivieren. (Wird in Phase 1
umgesetzt, sobald die Repositories angebunden sind.)

## 6. Qualitäts-Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # Vitest (Scoring-, RNG-, Schema-Tests)
npm run lint        # ESLint
npm run build       # Produktions-Build
```
