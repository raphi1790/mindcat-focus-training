#!/usr/bin/env bash
set -e

# Ensure gh CLI is available
if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI ('gh') is not installed."
  echo "Please install it via 'brew install gh' and authenticate via 'gh auth login'."
  exit 1
fi

echo "🚀 Seeding GitHub Issues from docs/FIX_PLAN_TESTRUNDE_2.md..."

# Check repository connection
gh repo view > /dev/null

create_issue() {
  local title="$1"
  local body="$2"
  echo "📦 Creating Issue: $title..."
  gh issue create --title "$title" --body "$body" --label "ready-for-agent,testrunde-2"
}

create_issue \
  "AP1 — Side: Ziel-Grasfelder & Hindernis-Schlamm (keine 1-Schritt-Shortcuts)" \
  "**Ziel:** Die Wiese liegt nicht mehr an allen 4 Rändern. Die Katze muss den Schlamm aktiv umgehen, um das Ziel zu erreichen.

**Aufgaben:**
1. \`src/training/exercises/side/maps.ts\` überarbeiten: Katze startet z. B. am unteren Rand (y=8, x=4). Ziel-Grasflächen werden als 2x2 Gras-Flecken am gegenüberliegenden (oberen) Rand platziert. Schlammflecken wachsen in den Stufen 2–7 in der Mitte auf.
2. \`maps.test.ts\` anpassen: Lösbarkeit (BFS-Pfad Start -> Ziel) und Hindernis-Platzierung absichern.

**Abnahme:** In keinem Level kann die Katze mit 1 Schritt die Wiese erreichen, ohne am Schlamm vorbeizusteuern. Map-Tests grün."

create_issue \
  "AP2 — Chase: 8-Wege-Diagonal-Treffererkennung & Level-Visualisierung" \
  "**Ziel:** Diagonallaufen fängt den Schirm verlässlich; der Schwierigkeitsanstieg wird im HUD sichtbar.

**Aufgaben:**
1. In \`src/training/exercises/chase/ChaseExercise.tsx\`: Bei Bewegung mit dx!=0 && dy!=0 prüfen, ob die Zielposition ODER ein angrenzendes Feld der Schirmposition entspricht. Wenn ja: Treffer auslösen.
2. Schwierigkeits-Feedback im HUD: Tempo-Icon (⚡/💨) neben dem Timer bei höheren Leveln einblenden.

**Abnahme:** Diagonalschritt fängt den Schirm verlässlich. HUD zeigt Tempo-Steigerung an."

create_issue \
  "AP3 — Maze: 2-Feld-breite Korridore in frühen Leveln (Level 1–3)" \
  "**Ziel:** 4-Jährige können mit dem Arcade-Joystick in den ersten Leveln flüssig abbiegen.

**Aufgaben:**
1. In \`src/training/exercises/maze/maps.ts\`: Level 1–3 überarbeiten, sodass Hauptwege mindestens 2 Felder breit sind. Level 4–6 dürfen 1–2 Felder breit bleiben.
2. Straffreies Abblocken (Wand stoppt Bewegung, Shake + Sound) beibehalten.
3. \`maps.test.ts\` aktualisieren.

**Abnahme:** Auf Level 1–3 lässt sich die Katze mit dem Joystick ohne ständiges Wandstreifen führen."

create_issue \
  "AP4 — Anticipation (unsichtbar): 800 ms Einstiegs-Cue vor dem Untertauchen" \
  "**Ziel:** Die unsichtbare Ente bietet eine echte Antizipations-Aufgabe statt 20%-Zufallsraten.

**Aufgaben:**
1. In \`AnticipationExercise.tsx\`: Auch bei visible=false wird die Ente zu Beginn des Trials für 800 ms in ihrer Zielspur oben angezeigt. Nach 800 ms taucht sie ab und schwimmt verdeckt weiter.
2. Vitest-Komponententest: Ente in den ersten 800 ms im DOM vorhanden, danach bis zur Catch-Phase verdeckt.

**Abnahme:** Das Kind sieht 800 ms lang die Zielspur, bevor die Ente untertaucht."

create_issue \
  "AP5 — Number-Stroop: Instruktion & visuelle Klarheit" \
  "**Ziel:** Bestätigung der Studien-Mechanik (Äpfel -> Zahlen) und optimale Verständlichkeit für 4-Jährige.

**Aufgaben:**
1. In \`NumberStroopExercise.tsx\`: Umschaltung von Äpfeln (Level 1–2) auf Zahlen-Konflikte (Level 3–6) beibehalten.
2. Instruktionsleiste unten optisch verstärken ('Welche Seite hat MEHR Gegenstände?' mit visuellem Mengen-Symbol).

**Abnahme:** Visuelle Instruktion ist für Vorschulkinder sofort verständlich."

create_issue \
  "AP6 — Spielstand-Persistenz: Verifikation & Status-Anzeige im Dashboard" \
  "**Ziel:** Transparente Anzeige des gespeicherten Fortschritts pro Kind.

**Aufgaben:**
1. Verifizieren, dass checkpoint (Übung + Level) bei jedem Level-Aufstieg zuverlässig in Firestore geschrieben wird.
2. Im Betreuer-Dashboard (ChildDashboard.tsx) beim Trainingsverlauf anzeigen, welches Level in den einzelnen Übungen erreicht wurde.

**Abnahme:** Nach Abbrechen und Wiederkehren wird der exakte Level-Stand angezeigt und fortgesetzt."

create_issue \
  "AP7 — Gesamte Verifikation (Testrunde 2)" \
  "**Ziel:** Gesamte QS aller Übungen und End-to-End Test.

**Aufgaben:**
1. typecheck, lint und test ausführen.
2. Dev-Server-Durchlauf aller 8 Übungen + ANT mit Tastatur und Arcade-Joystick.
3. npm run pilot (E2E-Pilottest) erfolgreich durchführen.

**Abnahme:** Alle Tests grün, E2E Pilot erfolgreich."

echo "✅ All AP1–AP7 GitHub Issues created successfully!"
