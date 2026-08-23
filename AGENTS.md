# Mindcat Focus Training — Developer & Agent Guidelines

Reimplementierung des Aufmerksamkeitstrainings für Kinder nach **Rueda et al. (2005, PNAS)** — wissenschaftlich belastbar, kindgerecht, mit Firestore-Persistenz.

Der maßgebliche Arbeitsplan ist [docs/IMPLEMENTATION_PLAN.md](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/IMPLEMENTATION_PLAN.md). Vor jeder Implementierungsarbeit lesen; er enthält Zielarchitektur, Datenmodell, Übungsparameter und den Phasenplan. Bei Widerspruch zwischen bestehendem Code und Plan gilt der Plan.

---

## 1. Festgelegter Scope (nicht neu verhandeln)

- **Tests:** Nur der **Child ANT** (Baseline vor Tag 1, Post nach Tag 5). K-BIT/CBQ sind proprietär → nicht nachbauen.
- **Training:** Alle ~8 Rueda-Übungen (Side, Chase, Maze, Anticipation ×2, Discrimination ×2, Number, Number-Stroop, Farmer).
- **Eingabe:** Tastatur **und** Arcade (Joystick + Arcade-Buttons). Kein Touch-First.
- **Alter:** Kohorten 4 und 6 Jahre; **Farmer nur für 6-Jährige**.

---

## 2. Wissenschaftliche Grundregel (oberste Priorität)

**Tests bleiben clean, Training darf verspielt sein.** Der ANT ist visuell minimal, standardisiert und reaktionszeit-rein — keine Sounds, Animationen oder Belohnungen, die RTs beeinflussen (Feedback nur im Übungsblock, nie im Testblock). Die Trainingsübungen dagegen sollen sich hervorragend anfühlen („Mario-Kart"-Feel). Diese Grenze nie verwischen.

Daraus folgt konkret:
- RT-Messung onset-genau: `performance.now()` + `requestAnimationFrame` nach tatsächlichem Paint, nie `setTimeout`-Annahmen.
- Seeded RNG für alle Trial-Sequenzen; Seed wird persistiert (Reproduzierbarkeit).
- ANT-Scoring: Median-RT korrekter Trials je Bedingung; Exclusion bei Fehlerrate > 40 %.
- Vollständige Roh-Trial-Logs speichern (Reanalyse-Fähigkeit).
- Level-Advancement der Übungen exakt nach den a/b/c-Parametern aus dem Plan (§6.2).

---

## 3. Technische & Architektonische Konventionen

* **[Coding Standards](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/standards/coding-standards.md)**: Grenzen (< 1000 Zeilen/Datei, < 300 Zeilen/Funktion, max. 3 Nesting-Ebenen, Clean Code & Pragmatic Engineer).
* **[Architecture Decision Records](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/adr/)**: Dokumentierte Architekturentscheidungen (MADR für Firebase/Firestore, React 19/Vite Stack etc.).
* **TypeScript**: Neuer Code wird ausnahmslos in TypeScript geschrieben; bestehende JSX-Dateien werden bei Berührung migriert.
* **Zod-Validierung an der Firestore-Grenze**: Jedes gelesene/geschriebene Dokument läuft durch ein Schema in `src/data/schema/`.
* **Datenmodell**: `users/{uid}/children/{childId}/{assessments,trainingSessions}` (Details im Plan §3). Die alte flache `testResults`-Collection ist deprecated.
* **Zeitstempel**: Firestore `serverTimestamp()`; client-seitige RTs zusätzlich via `performance.now()`.
* **Vitest-Testpflicht**: Wissenschaftlich und datentechnisch relevante Logik (Scoring, Median, Exclusion, Advancement, RNG-Determinismus) muss Unit-Tests besitzen.
* **Eingabe**: Ausschließlich über die Abstraktion in `src/platform/input/` (nicht direkt `keydown`/Gamepad-API in Komponenten).
* **UI-Sprache**: Deutsch (kindgerecht in Übungen, sachlich im Dashboard).
* **Datenschutz**: Kinderdaten sind sensibel: Pseudonyme statt Klarnamen bevorzugen, keine PII in URLs, Zugriff nur über Security-Rules-gesicherte Pfade des Betreuers.

---

## 4. Stack & Befehle

React 19 · Vite 8 · Tailwind 4 · Firebase (Auth + Firestore)

```bash
npm run dev          # Dev-Server starten
npm run build        # Produktions-Build erstellen
npm run typecheck    # TypeScript Typen prüfen
npm run lint         # ESLint prüfen
npm run test         # Vitest Unit- und Integrationstests ausführen
npm run pilot        # Längsschnitt-E2E-Pilottest ausführen
```

Firebase-Konfiguration über `VITE_FIREBASE_*`-Variablen in `.env` (Vorlage: `.env.example`). Ohne `.env` startet die App nicht sinnvoll. Firestore-Rules liegen in `firestore.rules` und binden alle Kinderdaten strikt an den eingeloggten Betreuer.

---

## 5. Developer Agent Workflow (Schritt-für-Schritt)

### Schritt 1: Arbeitspaket (GitHub Issue) holen
Hole ein freies GitHub Issue (Label: `ready-for-agent`) und beanspruche es:

```bash
npm run agent:take <ISSUE_ID>
```
* **Was passiert automatisch**:
  * Das Issue wird mit dem Label `agent:in-progress` getaggt (andere Agenten wissen, dass es vergeben ist).
  * Ein isolierter Git Worktree wird unter `.worktrees/issue-<ISSUE_ID>` erstellt und der Branch `feat/issue-<ISSUE_ID>` ausgecheckt.

---

### Schritt 2: Im Git Worktree entwickeln
Wechsle in das erstellte Worktree-Verzeichnis und löse das Ticket:

```bash
cd .worktrees/issue-<ISSUE_ID>
```
* Beachte die Coding Standards (< 1000 Zeilen/Datei, < 300 Zeilen/Funktion, max. 3 Nesting-Ebenen).
* Schreibe Vitest-Unit-Tests für wissenschaftliche/fachliche Logik.

---

### Schritt 3: Pre-Push Qualitätsprüfung (Quality Gate)
Bevor ein Ticket abgeschlossen werden darf, **müssen** alle Qualitätsprüfungen im Worktree bestanden werden:

```bash
npm run typecheck   # TypeScript Typen prüfen
npm run lint        # ESLint prüfen
npm run test        # Vitest-Tests ausführen
```

---

### Schritt 4: Ticket fertigstellen & PR einreichen
Wenn alle Tests und Linters grün sind, schließe das Ticket ab:

```bash
npm run agent:finish <ISSUE_ID>
```
* **Was passiert automatisch**:
  * Linter & Tests werden erneut als Safety-Check ausgeführt.
  * Die Änderungen werden auf GitHub gepusht.
  * Ein GitHub Pull Request wird automatisch erstellt (`gh pr create`).
  * Das GitHub Issue wechselt vom Label `agent:in-progress` zu **`status:human-review`**.
  * Der lokale Worktree wird aufgeräumt.

---

## 6. Grundregeln für Agenten

1. **Kein Direkt-Push auf `main`**: Alle Änderungen laufen über Worktrees, Branches (`feat/issue-<id>`) und PRs.
2. **Keine kaputten Builds pushen**: Ein Branch darf niemals gepusht werden, wenn `npm run lint` oder `npm test` fehlschlagen.
3. **Fokussierte PRs**: Bearbeite nur die Aufgaben des jeweiligen GitHub Issues.
4. **KEIN automatischer Merge & KEIN Schließen von Issues**: Der Agent erstellt den PR (`gh pr create`) und setzt das Issue-Label auf `status:human-review`. Der PR und das GitHub Issue bleiben **ausdrücklich offen**, bis ein menschlicher Entwickler sie im Human Review prüft und freigibt.
