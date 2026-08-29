#!/usr/bin/env bash
set -e

if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI ('gh') is required."
  exit 1
fi

echo "🚀 Creating GitHub Issues for Testrunde 4..."

gh label create testrunde-4 --description "Issues für Testrunde 4" --color "1D76DB" 2>/dev/null || true

create_issue() {
  local title="$1"
  local body="$2"
  echo "📦 Creating: $title..."
  gh issue create --title "$title" --body "$body" --label "ready-for-agent,testrunde-4"
}

# 1. CI/CD Deployment schärfen
create_issue \
  "CI/CD: GitHub Actions Deployment schärfen & Deployment-Dokumentation erstellen" \
  "**Kontext & Ziel:**
Das Projekt wurde erfolgreich auf GitHub Actions umgestellt und live auf Firebase Hosting deployt. Das Setup soll nun geschärft, gehärtet und dokumentiert werden.

**Aufgaben:**
1. **GitHub Actions Workflow (\`.github/workflows/deploy.yml\`) schärfen:**
   - Bereitstellung einer sauberen Trennung bzw. Konfiguration für Staging/Qual und Production (z. B. über GitHub Environments oder Tags/Branches).
   - Deployment von Firestore Security Rules zusammen mit Hosting (\`firebase deploy --only hosting,firestore:rules\`), damit Regeländerungen automatisch mit deployt werden.
   - Node-Version-Warnung beheben (Aktualisierung auf Node 22/24 oder explizite Konfiguration).
   - Saubere Fallback-Logik und Dokumentation der benötigten Secrets (\`FIREBASE_TOKEN\`, \`VITE_FIREBASE_*\`).
2. **Dokumentation (\`docs/DEPLOYMENT.md\`):**
   - Veraltete GitLab CI/CD Referenzen in \`docs/\` bereinigen.
   - Vollständige Anleitung für CI/CD- und manuelle Deployments erstellen (Secrets, Tags, Troubleshooting).

**Akzeptanzkriterien:**
- CI/CD Workflow läuft sauber ohne Deprecation-Warnungen durch.
- Firestore Security Rules werden zusammen mit der App synchronisiert.
- Dokumentation in \`docs/DEPLOYMENT.md\` ist vollständig und aktuell."

# 2. Bug: Spielstand-Persistenz & Level-Resume
create_issue \
  "Bug: Spielstand-Persistenz & Level-Resume (Übungen starten nach Verlassen wieder bei Level 1)" \
  "**Fehlerbeschreibung:**
Nachdem ein Kind (z. B. in 'Side') Level 2 erreicht hat und auf die Hauptseite/Dashboard zurückkehrt, startet ein erneuter Spielstart fälschlicherweise wieder bei Level 1 statt am zuletzt erreichten Level 2 fortzusetzen.

**Ursachenanalyse & Aufgaben:**
1. **Übungs-Initialisierung (\`SideExercise.tsx\` und weitere Übungen):**
   - In \`SideExercise.tsx\` ist die Katze-Startposition hardcoded auf \`getStartPosition(1)\` initialisiert (\`useState(() => getStartPosition(1))\`), anstatt \`getStartPosition(initialState?.level ?? 1)\` zu verwenden.
   - Alle 8 Rueda-Übungen daraufhin prüfen, ob \`initialState\` beim Mount das korrekte Level, Streak und die Startpositionen der Entitäten vollständig wiederherstellt.
2. **Firestore Checkpoint-Persistenz & Resume-Logik:**
   - Prüfen, ob \`onLevelUp\` in \`App.tsx\` (\`handleStandaloneLevelUp\`) und \`TrainingSessionRunner.tsx\` (\`handleLevelUp\`) den Checkpoint zuverlässig und vor dem Verlassen der Ansicht in Firestore schreibt.
   - \`getLatestStandaloneLevel\` und \`findInProgressSession\` daraufhin prüfen, ob der Checkpoint beim erneuten Start korrekt abgefragt und als \`initialState\` übergeben wird.
   - Sicherstellen, dass Firestore-Latenzen oder Navigationswechsel nicht zum Verlust des noch ungeschriebenen Checkpoints führen (z. B. Flush beim Verlassen / \`onCancel\`).
3. **Tests:**
   - Unit- und Integrationstests ergänzen, die das Szenario 'Level 1 abschließen -> Level 2 erreichen -> Verlassen -> Wiederstarten -> Level 2 aktiv' für 'Side' und die anderen Übungen simulieren und absichern.

**Akzeptanzkriterien:**
- Erreichte Level-Fortschritte bleiben beim Verlassen der Übung verlässlich erhalten.
- Ein Wiederaufruf der Übung (sowohl im 5-Tage-Trainingsplan als auch im Standalone-Modus) startet exakt auf dem zuletzt erreichten Level mit korrekter Spielfeld- und Spielfiguren-Position."

echo "✅ Both GitHub Issues created successfully!"
