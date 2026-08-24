#!/usr/bin/env bash
set -e

if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI ('gh') is required."
  exit 1
fi

echo "🚀 Creating 6 new GitHub Issues for Testrunde 3..."

# Ensure testrunde-3 label exists
gh label create testrunde-3 --description "Issues für Testrunde 3" --color "0E8A16" 2>/dev/null || true

create_issue() {
  local title="$1"
  local body="$2"
  echo "📦 Creating: $title..."
  gh issue create --title "$title" --body "$body" --label "ready-for-agent,testrunde-3"
}

# 1. Chase Hitbox & Continuous Collision
create_issue \
  "Chase: Schnelle Treffererkennung & Überhol-Erkennung (Continuous Hitbox / Interpolation)" \
  "**Problem:**
Bei schneller Bewegung oder schnellem Richtungswechsel kann die Katze über den Regenschirm hinwegspringen, ohne dass ein Treffer registriert wird.

**Aufgaben:**
1. In \`src/training/exercises/chase/ChaseExercise.tsx\`:
   - Bewegungspfad-Interpolation: Wenn die Katze sich von \`prev\` nach \`next\` bewegt, alle überstrichenen Zwischenfelder auf Kollision mit dem Schirm prüfen.
   - Gegenverkehr-Prüfung: Beim Schirm-Schritt prüfen, ob der Schirm die aktuelle Position der Katze betritt oder deren vorherigen Pfad gekreuzt hat.
2. Unit-Tests in \`ChaseExercise.test.tsx\` ergänzen, die schnelle diagonale und orthogonale Überhol-Manöver gezielt abprüfen.

**Abnahme:**
Selbst bei schnellster Tastenfolge oder Tastatur-Repeat wird ein Treffer verlässlich ausgelöst, sobald der Schirm passiert oder betreten wird."

# 2. Game Completion Feedback Screen
create_issue \
  "Feedback & Celebration Screen: Sanfter Übergang & Belohnungsanimation nach Spielabschluss" \
  "**Problem:**
Nach Abschluss einer Trainingsübung wechselt die Ansicht ohne Übergangsanimation oder Feedback zurück zur Übersicht, was abrupt und unvollständig wirkt.

**Aufgaben:**
1. Einführung einer wiederverwendbaren Abschluss-/Belohnungskomponente (z. B. \`ExerciseCompletionModal.tsx\` mit Konfetti, Level-Zusammenfassung und Erfolgs-Sound).
2. Vor dem Verlassen einer Übung (\`onComplete\` / \`onExit\`) wird dieser Screen eingeblendet und per Klick/Tastendruck oder nach kurzer Verzögerung bestätigt.
3. Einheitliche Einbindung über alle 8 Rueda-Übungen und Standalone-Starts.

**Abnahme:**
Nach Erreichen des Ziel-Levels oder Abschluss einer Übung erscheint eine ansprechende Abschluss-Animation vor der Rückkehr zur Übersicht."

# 3. Anticipation Rueda Scaling & Dynamic Position
create_issue \
  "Anticipation: Rueda-Studienabgleich & dynamische Startposition der Katze" \
  "**Problem & Studienabgleich (Rueda et al., 2005):**
Aktuell wird die Katze in jedem Trial auf die Mitte (Spur 2) zurückgesetzt. Dies fühlt sich wie der Child ANT an und verhindert echtes kontinuierliches Tracking.

**Aufgaben:**
1. In \`src/training/exercises/anticipation/AnticipationExercise.tsx\`:
   - Katze startet am Ende jedes Trials auf ihrer aktuellen Position (kein Reset zur Mitte).
   - Spurenanzahl dynamisch skalieren: 5 Spuren in Level 1–3, Erweiterung auf 7 Spuren in Level 4–7.
   - Ente kann auf jeder der verfügbaren Spuren auftauchen.
   - Für \`AnticipationInvisible\`: 800 ms Einstiegs-Cue beibehalten.
2. \`AnticipationExercise.test.tsx\` für neue Spurenskalierung und Positionserhaltung anpassen.

**Abnahme:**
Katze behält ihre Position; Spurenanzahl wächst ab Level 4 auf 7; Vitest-Tests für sichtbare und unsichtbare Variante sind 100 % grün."

# 4. Standalone Persistence & Progress Reset
create_issue \
  "Dashboard & Persistenz: Spielstand-Reset & Persistenz für Standalone-Einzeltests" \
  "**Problem:**
Standalone-Einzeltests (aus dem Tab 'Einzeltests') starten immer bei Level 1 und werden in Firestore nicht mit Zeitstempel protokolliert. Im Dashboard fehlt zudem eine Möglichkeit, den Fortschritt zurückzusetzen.

**Aufgaben:**
1. In \`App.tsx\` und \`src/data/firestore/\`:
   - Standalone-Übungsstarts in Firestore unter \`trainingSessions\` (mit Kennzeichnung \`mode: 'standalone'\`) mit Zeitstempel und erreichtem Level persistieren.
   - Beim Öffnen einer Standalone-Übung am letzten erreichten Level dieser Übung fortsetzen.
2. Im Betreuer-Dashboard (\`ChildDashboard.tsx\`):
   - Einen Button 'Spielstand zurücksetzen' mit sicherem Bestätigungs-Dialog einbauen.
   - Beim Bestätigen werden die Trainingssitzungen für das Kind zurückgesetzt (Neustart von Tag 1 / Baseline).
3. Korrespondierende Unit-Tests für Standalone-Persistenz und Reset schreiben.

**Abnahme:**
Standalone-Spiele speichern und laden ihr Level; Betreuer kann den Spielstand im Dashboard kontrolliert zurücksetzen."

# 5. GitLab CI/CD Pipeline
create_issue \
  "GitLab CI/CD: Tag-basiertes Deployment (Qual/Prod) & automatisierte Quality Checks" \
  "**Ziel:**
Automatisierte CI/CD Pipeline für GitLab mit Quality-Gates und Firebase-Hosting-Deployments über Git-Tags.

**Aufgaben:**
1. \`.gitlab-ci.yml\` erstellen:
   - Stage \`test\`: Führt \`npm run typecheck\`, \`npm run lint\` und \`npm test\` auf allen Branches/Commits aus.
   - Stage \`build\`: Baut das Produktions-Bundle (\`npm run build:qual\` / \`npm run build:prod\`).
   - Stage \`deploy\`:
     - Bei Git-Tags (z. B. \`v1.0.0\`) automatisches Deployment auf Firebase Hosting (Qual-Environment).
     - Manueller Button/Job auf demselben Tag für Prod-Deployment.
2. Konfigurationsdokumentation für GitLab CI/CD Variablen in \`docs/SETUP.md\` oder \`docs/standards/\` hinterlegen.

**Abnahme:**
Syntaktisch valide \`.gitlab-ci.yml\`, die Tests ausführt und Tag-Deployments nach Qual/Prod ermöglicht."

# 6. E2E Full Lifecycle Database Test
create_issue \
  "E2E-Testsuite: Vollständiger Lebenszyklus-Durchlauf mit echter Firestore-Persistenz (npm run test:e2e)" \
  "**Ziel:**
Ein vollständiger End-to-End Test, der den gesamten Studienlebenszyklus mit echten Lese- und Schreiboperationen im Firestore Emulator durchspielt und verifiziert.

**Aufgaben:**
1. \`src/validation/e2eLifecycle.test.ts\` erstellen:
   - Erstellt ein Test-Kind.
   - Führt Child ANT Baseline durch und speichert \`assessments\`-Dokument.
   - Durchspielt 5 Trainingstage mit allen Übungen und speichert \`trainingSessions\`-Dokumente samt Checkpoints.
   - Führt Post-ANT durch und speichert Ergebnis.
   - Liest alle Daten aus Firestore aus und validiert sie gegen die Zod-Schemas.
2. In \`package.json\` das Skript \`npm run test:e2e\` (via Firebase Emulator) bereitstellen.

**Abnahme:**
\`npm run test:e2e\` läuft im Firestore Emulator erfolgreich durch und bestätigt die vollständige Datenbankintegrität."

echo "✅ All 6 GitHub Issues created successfully!"
