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

## 7. GitLab CI/CD & Deployment

Die CI/CD-Pipeline (`.gitlab-ci.yml`) führt bei jedem Push und Merge Request automatische Quality-Checks aus und deployt getaggte Releases (`vX.Y.Z`) auf Firebase Hosting.

### Pipeline-Stufen

1. **`test`**: Läuft auf allen Branches und Commits:
   - `typecheck`: TypeScript-Typüberprüfung (`tsc --noEmit`)
   - `lint`: ESLint-Prüfung (`eslint .`)
   - `unit-tests`: Vitest Unit- und Integrationstests (`npm test`)
   - `pilot-test`: Längsschnitt-E2E-Pilottest (`npm run pilot`)
2. **`build`**: Erstellt die Bundles (`build:qual` für Staging/Qual, `build:prod` für Produktion) und sichert die `dist/`-Artefakte.
3. **`deploy`**: Tag-basiertes Deployment (z. B. `v1.0.0`):
   - `deploy:qual`: Automatisches Deployment (`on_success`) auf die Qual/Staging-Umgebung.
   - `deploy:prod`: Manuell freizugebendes Deployment (`manual`) auf die Produktivumgebung.

### Erforderliche GitLab CI/CD Variablen

Unter **Settings → CI/CD → Variables** (als *Protected* und *Masked* hinterlegen):

| Variable | Beschreibung |
|---|---|
| `FIREBASE_TOKEN` | CI-Token generiert via `firebase login:ci` |
| `FIREBASE_PROJECT_QUAL` | Firebase Projekt-ID für die Qual/Staging-Umgebung |
| `FIREBASE_PROJECT_PROD` | Firebase Projekt-ID für die Produktivumgebung |
| `VITE_FIREBASE_*` | Optional: Environment-spezifische API-Keys falls nicht in `.env.*` hinterlegt |

### Release- & Deployment-Ablauf

1. Release taggen und pushen:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. Die Pipeline führt `test` (`typecheck`, `lint`, `unit-tests`, `pilot-test`) und `build` (`build:qual`, `build:prod`) aus.
3. Nach erfolgreichem Durchlauf wird `deploy:qual` automatisch ausgeführt.
4. Das Release kann auf der Qual-Umgebung geprüft werden (`https://$FIREBASE_PROJECT_QUAL.web.app`).
5. Anschließend kann `deploy:prod` in der GitLab CI-Pipeline-Übersicht per Klick manuell freigegeben werden (`https://$FIREBASE_PROJECT_PROD.web.app`).

