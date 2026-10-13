# Mindcat Focus Training — Developer & Agent Guidelines

Reimplementierung des Aufmerksamkeitstrainings für Kinder nach **Rueda et al. (2005, PNAS)** — wissenschaftlich belastbar, kindgerecht, mit Firestore-Persistenz.

Verbindliche Architektur- und Spezifikationsvorgaben sind in den [Architecture Decision Records (ADRs)](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/adr/) dokumentiert (insbesondere [ADR 0004](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/adr/0004-scientific-rueda-exercise-and-ant-specifications.md) für Übungsparameter und Child ANT). 

**Die Aufgabensteuerung erfolgt ausschließlich über GitHub Issues.** Jede Implementierung, jeder Bugfix und jedes Feature wird über ein zugehöriges GitHub Issue abgewickelt.

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
- Level-Advancement der Übungen exakt nach den a/b/c-Parametern aus [ADR 0004](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/adr/0004-scientific-rueda-exercise-and-ant-specifications.md).

---

## 3. Technische & Architektonische Konventionen

* **[Coding Standards](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/standards/coding-standards.md)**: Grenzen (< 1000 Zeilen/Datei, < 300 Zeilen/Funktion, max. 3 Nesting-Ebenen, Clean Code & Pragmatic Engineer).
* **[Architecture Decision Records](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/adr/)**: Dokumentierte Architekturentscheidungen (MADR für Firebase/Firestore, React 19/Vite Stack, Rueda-Spezifikation etc.).
* **TypeScript**: Neuer Code wird ausnahmslos in TypeScript geschrieben; bestehende JSX-Dateien werden bei Berührung migriert.
* **Zod-Validierung an der Firestore-Grenze**: Jedes gelesene/geschriebene Dokument läuft durch ein Schema in `src/data/schema/`.
* **Datenmodell**: `users/{uid}/children/{childId}/{assessments,trainingSessions}` ([ADR 0002](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/adr/0002-firebase-and-firestore-persistence.md)). Die alte flache `testResults`-Collection ist deprecated.
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

## 5. GitHub Issues & Agent Workflow (Schritt-für-Schritt)

Alle Aufgaben werden über GitHub Issues gesteuert. Damit mehrere Entwickler bzw. Agenten nicht am selben Ticket arbeiten und Konflikte vermieden werden, ist der Ablauf strikt getaktet:

### Schritt 1: Arbeitspaket (GitHub Issue) holen
Wähle ein freies Issue mit dem Label `ready-for-agent` aus (`gh issue list --label ready-for-agent`) und beanspruche es:

```bash
npm run agent:take <ISSUE_ID>
```
* **Was automatisch passiert**:
  * Das Issue wird mit dem Label `agent:in-progress` getaggt und `ready-for-agent` wird entfernt (sperrt das Ticket für andere Agenten).
  * Ein isolierter Git Worktree wird unter `.worktrees/issue-<ISSUE_ID>` erstellt und der Branch `feat/issue-<ISSUE_ID>` ausgecheckt.

---

### Schritt 2: Im Git Worktree entwickeln
Wechsle in das erstellte Worktree-Verzeichnis und bearbeite das Ticket:

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
* **Was automatisch passiert**:
  * Linter & Tests werden erneut als Safety-Check ausgeführt.
  * Offene Änderungen werden committet (`feat: complete tasks for issue #<ISSUE_ID>`).
  * Der Branch wird auf GitHub gepusht.
  * Ein GitHub Pull Request wird automatisch via `gh pr create` erstellt.
  * Das GitHub Issue wechselt vom Label `agent:in-progress` zu **`status:human-review`**.

---

## 6. Grundregeln für Agenten

1. **GitHub Issues sind die einzige Arbeitsquelle**: Keine eigenmächtigen Implementierungen ohne zugehöriges GitHub Issue.
2. **Kein Direkt-Push auf `main`**: Alle Änderungen laufen über isolierte Worktrees, Branches (`feat/issue-<id>`) und PRs.
3. **Keine kaputten Builds pushen**: Ein Branch darf niemals gepusht werden, wenn `npm run typecheck`, `npm run lint` oder `npm test` fehlschlagen.
4. **Fokussierte PRs**: Bearbeite nur die Aufgaben des jeweiligen GitHub Issues.
5. **KEIN automatischer Merge & KEIN Schließen von Issues**: Der Agent erstellt den PR (`gh pr create`) und setzt das Issue-Label auf `status:human-review`. Der PR und das GitHub Issue bleiben **ausdrücklich offen**, bis ein menschlicher Entwickler sie im Human Review prüft und freigibt.
