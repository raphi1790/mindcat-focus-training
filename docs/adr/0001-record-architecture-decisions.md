# 1. Architecture Decision Records (ADR) verwenden

* Status: accepted
* Datum: 2026-08-21

## Kontext und Problemstellung

Im Projekt **Mindcat Focus Training** treffen wir maßgebliche technische und wissenschaftliche Architekturentscheidungen (z. B. Datenbankschema, Frameworks, Messmethoden). Um Nachvollziehbarkeit für Entwickler und Agenten sicherzustellen, benötigen wir ein leichtgewichtiges Format zur Dokumentation dieser Entscheidungen.

## In Betracht gezogene Optionen

1. Mündliche Absprachen / Inline-Kommentare
2. Zentrale Readme-Datei
3. MADR (Markdown Architectural Decision Records) im Ordner `docs/adr/`

## Entscheidung

Wir entscheiden uns für **Option 3: MADR im Ordner `docs/adr/`**.

### Konsequenzen

* Jede wesentliche Architekturentscheidung wird als nummerierte Markdown-Datei (`000x-titel.md`) in `docs/adr/` abgelegt.
* Neue Entwickler und AI-Agenten können die Historie und Gründe von Designentscheidungen schnell nachvollziehen.
