# Developer Agent Guidelines & Workflow

Willkommen im Entwickler-Agenten-Handbuch für **Mindcat Focus Training**. Dieses Dokument definiert, wie Entwickler-Agenten eigenständig Arbeitspakete (GitHub Issues) bearbeiten, isoliert entwickeln und nach erfolgreicher Qualitätsprüfung abgeben.

---

## 1. Verweise & Standards

Vor jeder Aufgabe müssen die folgenden Spezifikationen beachtet werden:

* **[CLAUDE.md](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/CLAUDE.md)**: Projekt-Scope, wissenschaftliche Grundregeln (ANT vs. Training) & Tech-Stack.
* **[Coding Standards](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/standards/coding-standards.md)**: Grenzen (< 1000 Zeilen/Datei, < 300 Zeilen/Funktion, max. 3 Nesting-Ebenen, Clean Code & Pragmatic Engineer).
* **[Architecture Decision Records](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/docs/adr/)**: Dokumentierte Architekturentscheidungen (Firebase/Firestore, React 19/Vite Stack).

---

## 2. Agent Workflow (Schritt-für-Schritt)

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
* Beachte die Coding Standards (< 1000 Zeilen/Datei, < 300 Zeilen/Funktion).
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

## 3. Grundregeln für Agenten

1. **Kein Direkt-Push auf `main`**: Alle Änderungen laufen über Worktrees, Branches (`feat/issue-<id>`) und PRs.
2. **Keine kaputten Builds pushen**: Ein Branch darf niemals gepusht werden, wenn `npm run lint` oder `npm test` fehlschlagen.
3. **Fokussierte PRs**: Bearbeite nur die Aufgaben des jeweiligen GitHub Issues.
