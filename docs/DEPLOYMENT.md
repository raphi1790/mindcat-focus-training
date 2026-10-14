# Deployment & CI/CD Dokumentation

Dieses Dokument beschreibt die Architektur, die Umgebungen, die Konfiguration der GitHub Actions CI/CD Pipeline, die benötigten Berechtigungen (GCP IAM) sowie Verfahren für manuelle Deployments und Troubleshooting für **Mindcat Focus Training**.

---

## 1. Architektur-Übersicht

Das Frontend ist eine **Single Page Application (SPA)**, basierend auf:
- **React 19 & Vite 8** mit Tailwind CSS.
- **Firebase Hosting** für das Ausliefern der statischen Produktions-Bundles (`dist/`) inklusive SPA-Rewrites auf `index.html`.
- **Cloud Firestore** als NoSQL-Persistenzschicht mit strikten Sicherheitsregeln (`firestore.rules`).

### CI/CD Pipeline (`.github/workflows/deploy.yml`)
- **Automatisierte Quality Gates** bei jedem Push auf `main`, jedem Pull Request und jedem Release-Tag.
- **Laufzeitumgebung**: Node.js 22 LTS (`actions/setup-node@v4`) und Java 21 Temurin (`actions/setup-java@v4`) für den Firebase Emulator.
- **Emulator-Caching**: Download-Artefakte des Firebase Emulators werden unter `~/.cache/firebase/emulators` via `actions/cache@v4` zwischengespeichert, um schnelle CI-Laufzeiten zu garantieren.
- **Atomares Deployment**: Veröffentlicht Hosting **und** Firestore Security Rules zusammen (`firebase deploy --only hosting,firestore:rules`), sodass Regeländerungen und Client-Code stets synchron produktiv gehen.

---

## 2. Umgebungen & Deployment-Strategie

Das Projekt unterscheidet strikt zwischen **Qualitätssicherung / Staging (`qual`)** und **Produktion (`production`)**.

| Eigenschaft | Staging / Qual (`qual`) | Produktion (`production`) |
|---|---|---|
| **Zweck** | Integrationstests, Abnahme, Feature-Testing | Wissenschaftliche Studien, echte Trainingsdaten |
| **Trigger** | Push auf Branch `main`, manuell via `workflow_dispatch` | Push eines Git-Tags `v*` (z. B. `v1.0.0`), manuell via `workflow_dispatch` |
| **GitHub Environment** | `qual` | `production` |
| **Build-Kommando** | `npm run build:qual` (`--mode qual`) | `npm run build:prod` (`--mode production`) |
| **Standard-URL** | `https://mindcat-focus-training-qual.web.app` | `https://mindcat-focus-training.web.app` |
| **Deploy-Ziel** | Hosting + Firestore Rules | Hosting + Firestore Rules |

---

## 3. Quality Gates in CI

Vor jedem Deployment durchläuft der Code die definierten Quality Gates im Job `test`:

1. **`npm run typecheck`**: TypeScript-Compiler-Prüfung (`tsc --noEmit`).
2. **`npm run lint`**: ESLint-Prüfung nach Projektstandards.
3. **`npm test`**: Vitest Unit- und Schema-Validierungstests (Scoring, Median, Exclusion, Zod-Schemas).
4. **`npm run pilot`**: Längsschnitt-E2E-Pilottest (5 Trainingstage Simulation nach Rueda et al.).
5. **`npm run test:rules`**: Firestore Security Rules Tests im isolierten Firestore-Emulator.
6. **`npm run test:e2e`**: End-to-End Datenbank Lifecycle Tests im Firestore-Emulator.

Erst wenn **alle** Prüfungen erfolgreich bestanden wurden, schalten nachfolgende Deploy-Jobs frei.

---

## 4. Authentifizierung & GCP IAM Rollen

Für das Deployment in GitHub Actions wird primär ein **Google Cloud Service Account** verwendet. Ein Legacy-Token (`FIREBASE_TOKEN`) steht als Fallback zur Verfügung.

### 4.1 Empfohlene Methode: Google Cloud Service Account

Die Authentifizierung erfolgt über die offizielle GitHub Action `google-github-actions/auth@v2`. Der JSON-Schlüssel des Service Accounts wird im Secret `FIREBASE_SERVICE_ACCOUNT` hinterlegt.

#### Erforderliche GCP IAM-Rollen
Der Service Account benötigt in Google Cloud folgende Rollen:

| IAM-Rolle | Rollenname | Zweck |
|---|---|---|
| `roles/firebasehosting.admin` | Firebase Hosting-Administrator | Verwalten von Hosting-Releases, Hochladen statischer Assets |
| `roles/firebaserules.admin` | Firebase Rules-Administrator | Validieren und Bereitstellen von `firestore.rules` |
| `roles/serviceusage.serviceUsageConsumer` | Service Usage-Verbraucher | Ausführen von API-Aufrufen gegen Firebase/GCP APIs |

#### Service Account erstellen & konfigurieren (CLI)

```bash
# 1. Service Account anlegen
gcloud iam service-accounts create github-deployer \
  --description="Service Account for GitHub Actions Deployment" \
  --display-name="GitHub Actions Deployer"

# 2. Benötigte Rollen zuweisen
PROJECT_ID="mindcat-focus-training"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:github-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/firebasehosting.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:github-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/firebaserules.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:github-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"

# 3. JSON-Schlüsseldatei generieren
gcloud iam service-accounts keys create sa-key.json \
  --iam-account="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# Den Inhalt von sa-key.json anschließend als GitHub Secret FIREBASE_SERVICE_ACCOUNT hinterlegen.
```

### 4.2 Fallback-Methode: `FIREBASE_TOKEN`

Sollte kein Service Account hinterlegt sein, greift die Pipeline auf das Secret `FIREBASE_TOKEN` zurück:

```bash
# Token lokal generieren:
firebase login:ci
```
Den ausgegebenen Refresh-Token in GitHub unter **Settings → Secrets and variables → Actions** als Secret `FIREBASE_TOKEN` eintragen.

---

## 5. GitHub Secrets & Variables Konfiguration

Konfigurieren Sie unter **GitHub Repository → Settings → Environments** jeweils für `qual` und `production` folgende Werte:

### Secrets (vertraulich)

| Secret Name | Typ | Beschreibung |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | JSON-Schlüssel des GCP Service Accounts (bevorzugt) |
| `FIREBASE_TOKEN` | Secret | Fallback CI-Token (via `firebase login:ci`) |
| `VITE_FIREBASE_API_KEY` | Secret | Web-App Firebase API-Key |

### Variables (öffentlich / Umgebungskonfiguration)

| Variable Name | Typ | Beispielwert |
|---|---|---|
| `VITE_FIREBASE_PROJECT_ID` | Variable | `mindcat-focus-training` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Variable | `mindcat-focus-training.firebaseapp.com` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Variable | `mindcat-focus-training.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Variable | `271641143680` |
| `VITE_FIREBASE_APP_ID` | Variable | `1:271641143680:web:ec9a869f551f1b8bf47965` |
| `FIREBASE_PROJECT_ID` | Variable | (Optional) Projekt-ID für Firebase CLI falls abweichend |

> **Sicherheitshinweis**: In `.github/workflows/deploy.yml` sind keinerlei Default-Werte oder Credentials hardcodiert. Fehlende Secrets führen zu einem kontrollierten Abbruch des Deployments.

---

## 6. Release-Ablauf (Schritt-für-Schritt)

### 6.1 Automatisches Deployment auf Qual (Staging)
1. Änderungen auf Feature-Branches entwickeln und via Pull Request nach `main` mergen.
2. Nach dem Merge führt GitHub Actions automatisch den Job `test` und anschließend `deploy-qual` aus.
3. Die Änderungen stehen unter `https://<qual-project-id>.web.app` zur Überprüfung bereit.

### 6.2 Produktiv-Release erstellen
1. Sicherstellen, dass der `main`-Branch aktuell und auf Qual abgenommen ist.
2. Neues semantisches Git-Tag erstellen und pushen:
   ```bash
   git checkout main
   git pull origin main
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions startet den `deploy-prod`-Workflow.
4. Nach erfolgreichem Durchlauf ist die neue Version live unter `https://mindcat-focus-training.web.app`.

### 6.3 Manuelles Auslösen via GitHub UI (`workflow_dispatch`)
1. Im GitHub Repository zu **Actions → CI/CD Pipeline** navigieren.
2. Auf **Run workflow** klicken.
3. Branch auswählen (`main`) und Ziel-Umgebung wählen (`qual`, `production` oder `both`).
4. Klick auf **Run workflow**.

---

## 7. Manuelles Deployment (Entwickler & Notfall)

Falls ein Deployment außerhalb von GitHub Actions erforderlich ist:

### Voraussetzungen
- Node.js ≥ 22 und npm
- Firebase CLI: `npm install -g firebase-tools`
- Ausgefüllte `.env` (oder `.env.qual` / `.env.production`)

### Ablauf

```bash
# 1. Lokale Qualitätssicherung
npm run typecheck
npm run lint
npm test
npm run test:rules

# 2. Bei Firebase authentifizieren
firebase login

# 3. Projekt auswählen (z. B. default oder Projekt-ID)
firebase use mindcat-focus-training

# 4. Bundle bauen
npm run build:prod

# 5. Hosting und Firestore Security Rules gemeinsam deployen
firebase deploy --only hosting,firestore:rules
```

### Selektive Deployments
```bash
# Nur Firestore Security Rules aktualisieren:
firebase deploy --only firestore:rules

# Nur Hosting aktualisieren (ohne Rules):
firebase deploy --only hosting
```

---

## 8. Troubleshooting

### `HTTP Error: 403, The caller does not have permission`
- **Ursache**: Der Service Account verfügt nicht über ausreichende Rollen.
- **Lösung**: Prüfen, ob `roles/firebasehosting.admin` und `roles/firebaserules.admin` für den Service Account im GCP IAM vergeben sind.

### `Java runtime not found` / `firebase emulators:exec` schlägt fehl
- **Ursache**: Der Firestore-Emulator benötigt eine installierte Java Virtual Machine.
- **Lösung**: In GitHub Actions muss `actions/setup-java@v4` mit Java 21 Temurin eingebunden sein. Lokal: `brew install openjdk@21` (macOS) bzw. OpenJDK installieren.

### Firestore Rules werden nach Deployment nicht aktualisiert
- **Ursache**: Es wurde versehentlich nur `firebase deploy --only hosting` statt `firebase deploy --only hosting,firestore:rules` ausgeführt.
- **Lösung**: Immer beide Komponenten deployen oder gezielt `firebase deploy --only firestore:rules` aufrufen.

### Firebase App / Auth initialisiert nicht im Browser
- **Ursache**: Die Umgebungsvariablen `VITE_FIREBASE_*` fehlten beim Build-Schritt. Da Vite Umgebungsvariablen zur Compile-Zeit einbindet, müssen diese als GitHub Secrets/Variables im jeweiligen Environment gesetzt sein.
- **Lösung**: Secrets in GitHub Settings kontrollieren und den Build-Schritt im Workflow-Log prüfen.

### Emulator Cache veraltet oder korrupt
- **Ursache**: Unvollständiger Download der Emulator-Jars im Cache.
- **Lösung**: In GitHub Actions unter **Actions → Caches** den Cache `*-firebase-emulators-*` löschen und Workflow neu starten.
