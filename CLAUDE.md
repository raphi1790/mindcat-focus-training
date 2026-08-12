# Mindcat Focus Training

Reimplementierung des Aufmerksamkeitstrainings für Kinder nach **Rueda et al. (2005, PNAS)** — wissenschaftlich belastbar, kindgerecht, mit Firestore-Persistenz.

**Der maßgebliche Arbeitsplan ist `docs/IMPLEMENTATION_PLAN.md`.** Vor jeder Implementierungsarbeit lesen; er enthält Zielarchitektur, Datenmodell, Übungsparameter und den Phasenplan. Bei Widerspruch zwischen bestehendem Code und Plan gilt der Plan.

## Festgelegter Scope (nicht neu verhandeln)

- **Tests:** Nur der **Child ANT** (Baseline vor Tag 1, Post nach Tag 5). K-BIT/CBQ sind proprietär → nicht nachbauen.
- **Training:** Alle ~8 Rueda-Übungen (Side, Chase, Maze, Anticipation ×2, Discrimination ×2, Number, Number-Stroop, Farmer).
- **Eingabe:** Tastatur **und** Arcade (Joystick + Arcade-Buttons). Kein Touch-First.
- **Alter:** Kohorten 4 und 6 Jahre; **Farmer nur für 6-Jährige**.

## Wissenschaftliche Grundregel (oberste Priorität)

**Tests bleiben clean, Training darf verspielt sein.** Der ANT ist visuell minimal, standardisiert und reaktionszeit-rein — keine Sounds, Animationen oder Belohnungen, die RTs beeinflussen (Feedback nur im Übungsblock, nie im Testblock). Die Trainingsübungen dagegen sollen sich hervorragend anfühlen („Mario-Kart"-Feel). Diese Grenze nie verwischen.

Daraus folgt konkret:
- RT-Messung onset-genau: `performance.now()` + rAF nach tatsächlichem Paint, nie `setTimeout`-Annahmen.
- Seeded RNG für alle Trial-Sequenzen; Seed wird persistiert (Reproduzierbarkeit).
- ANT-Scoring: Median-RT korrekter Trials je Bedingung; Exclusion bei Fehlerrate > 40 %.
- Vollständige Roh-Trial-Logs speichern (Reanalyse-Fähigkeit).
- Level-Advancement der Übungen exakt nach den a/b/c-Parametern aus dem Plan (§6.2).

## Technische Konventionen

- **Neuer Code in TypeScript**; bestehende JSX-Dateien werden bei Berührung migriert.
- **zod-Validierung an der Firestore-Grenze** — jedes gelesene/geschriebene Dokument läuft durch ein Schema in `src/data/schema/`.
- Datenmodell: `users/{uid}/children/{childId}/{assessments,trainingSessions}` (Details im Plan §3). Die alte flache `testResults`-Collection ist deprecated.
- Zeitstempel: Firestore `serverTimestamp()`; client-seitige RTs zusätzlich via `performance.now()`.
- **Vitest-Tests sind Pflicht** für wissenschaftlich relevante Logik (Scoring, Median, Exclusion, Advancement, RNG-Determinismus).
- Eingabe ausschließlich über die Abstraktion in `src/platform/input/` (nicht direkt `keydown`/Gamepad-API in Komponenten).
- UI-Sprache ist Deutsch (kindgerecht in Übungen, sachlich im Dashboard).

## Stack & Befehle

React 19 · Vite 8 · Tailwind 4 · Firebase (Auth + Firestore)

```bash
npm run dev        # Dev-Server
npm run build      # Produktions-Build
npm run lint       # ESLint
```

Firebase-Konfiguration über `VITE_FIREBASE_*`-Variablen in `.env` (Vorlage: `.env.example`). Ohne `.env` startet die App nicht sinnvoll. Firestore-Rules liegen in `firestore.rules` und binden alle Kinderdaten strikt an den eingeloggten Betreuer.

## Datenschutz

Kinderdaten sind sensibel: Pseudonyme statt Klarnamen bevorzugen, keine PII in URLs, Zugriff nur über die Security-Rules-gesicherten Pfade des eingeloggten Betreuers.
