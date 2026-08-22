# 2. Firebase Authentication & Firestore Datenpersistenz

* Status: accepted
* Datum: 2026-08-21

## Kontext und Problemstellung

Die Aufmerksamkeitsstudie erfordert eine sichere Persistierung von Trainings- und ANT-Testergebnissen von Kindern (4 und 6 Jahre), inklusive inkrementellem Sitzungs-Speichern (Crash-Resilienz) und Datenschutzkonformität.

## In Betracht gezogene Optionen

1. Lokaler Browser LocalStorage / IndexedDB
2. Eigener Node.js / PostgreSQL Backend-Server
3. Firebase Auth + Cloud Firestore mit Zod Schema-Validierung

## Entscheidung

Wir entscheiden uns für **Option 3: Firebase Auth + Cloud Firestore**.

### Details & Regeln:
* **Datenstruktur**: Strukturierter geschachtelter Pfad `users/{uid}/children/{childId}/{assessments,trainingSessions}`.
* **Datenschutz**: Keine Klarnamen oder PII in Datensätzen; Pseudonyme/IDs bevorzugen.
* **Trust Boundaries**: Sämtliche Lese- und Schreiboperationen werden clientseitig strikt gegen Zod-Schemas in `src/data/schema/` validiert.
* **Inkrementelle Speicherung**: Bei Trainingsübungen wird nach jedem Level-Aufstieg ein `checkpoint` in Firestore geschrieben, um bei Abbrüchen nahtlos fortzusetzen.

### Konsequenzen

* Sichere Authentifizierung für Betreuer/Versuchsleiter.
* Datenschutzkonforme Trennung der Betreuerdaten via Firestore Security Rules (`firestore.rules`).
* Keine Server-Wartung notwendig.
