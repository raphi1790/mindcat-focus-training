# Coding Standards & Clean Code Guidelines

Diese Richtlinien definieren die Entwicklungsstandards für das Projekt **Mindcat Focus Training**. Alle menschlichen Entwickler und AI-Agenten müssen diesen Regeln ohne Ausnahme folgen.

---

## 1. Code-Struktur & Umfangsgrenzen

* **Maximale Dateilänge**: **< 1000 Zeilen pro Datei** (Ziel: < 300 Zeilen). Wenn eine Datei wächst, teile sie in kohärente Subkomponenten oder Utility-Module auf.
* **Maximale Funktionslänge**: **< 300 Zeilen pro Funktion/Komponente** (Ziel: < 50 Zeilen). Jede Funktion erfüllt genau eine Verantwortung.
* **Nesting-Tiefe (Verschachtelung)**: **Maximal 3 Ebenen tief**.
  * Nutze Guard Clauses und Early Returns (`if (!valid) return;`) statt tief verschachtelter `if-else`-Kaskaden.
  * Vermeide tief verschachtelte Callbacks; nutze `async/await` oder deklarative Funktionen.

---

## 2. Pragmatic Engineer & Ponytail-Prinzipien

* **YAGNI (You Aren't Gonna Need It)**: Baue nur Code und Abstraktionen, die für die aktuelle Anforderung benötigt werden. Keine spekulativen Features.
* **Wiederverwendung vor Neuentwicklung**: Nutze bestehende Hilfsfunktionen (z. B. RNG, Canvas-Utilities, Input-Abstraktionen in `src/platform/input/`), anstatt eigene Nachbauten zu schreiben.
* **Plattform & Standardbibliothek**: Bevorzuge nativer Plattform-Funktionen (z. B. `performance.now()`, standard JS/TS APIs) vor neuen npm-Abhängigkeiten.
* **Kleine, fokussierte Diffs**: Der kürzeste korrekte Diff gewinnt. Löschen ist besser als Hinzufügen.

---

## 3. Wissenschaftliche & Technische Konventionen

* **Typ-Sicherheit (TypeScript)**: Neuer Code wird ausnahmslos in TypeScript geschrieben. Vermeide `any`.
* **Firestore & Trust Boundaries**: Alle Daten an der Firestore-Grenze laufen durch **zod-Schemas** (`src/data/schema/`). Sensible Kinderdaten werden pseudonymisiert gespeichert.
* **Präzisions-Timing**: Reaktionszeiten (RTs) werden onset-genau via `performance.now()` + `requestAnimationFrame` gemessen — **niemals** via `setTimeout`.
* **Vitest-Testpflicht**: Wissenschaftlich und datentechnisch relevante Logik (Scoring, Median-RT, Exclusions, Level-Advancement, Seeded RNG) besitzt korrespondierende Vitest-Unit-Tests.

---

## 4. Quality Gate vor Push / PR

Bevor ein Branch gepusht oder ein Pull Request erstellt wird, **müssen** folgende Befehle lokal fehlerfrei durchlaufen:

```bash
npm run typecheck   # Keine TypeScript-Typfehler
npm run lint        # Keine ESLint-Fehler oder -Warnungen
npm run test        # Alle Unit- & Integrationstests grün
```
