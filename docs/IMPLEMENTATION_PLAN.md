# Mindcat Focus Training — Umsetzungsplan

> Reimplementierung des Aufmerksamkeitstrainings nach **Rueda et al. (2005)**,
> *"Training, maturation, and genetic influences on the development of executive attention"*, PNAS 102(41):14931–14936.
>
> Ziel: Ein **wissenschaftlich belastbares** Trainings- und Testsystem für Kinder, das
> (a) einen standardkonformen **Child ANT** als Ein- und Ausgangsmessung liefert,
> (b) das vollständige **5-Tage-Trainingsprogramm** (alle ~8 Übungen) umsetzt,
> (c) sich für Kinder **hervorragend anfühlt** (Game-Feel „Mario-Kart"-Niveau),
> und dabei reproduzierbare, exportierbare Daten in Firestore ablegt.

Dieses Dokument ist der Arbeitsplan für das ausführende Modell (Sonnet/Opus). Es ist so
geschrieben, dass Entscheidungen bereits getroffen sind und Phasen inkrementell abarbeitbar sind.

---

## 0. Festgelegte Rahmenentscheidungen

| Thema | Entscheidung | Konsequenz |
|---|---|---|
| **Testbatterie** | **Nur Child ANT** | K-BIT (IQ) und CBQ (Temperament) sind proprietär → **nicht** nachbauen. Der ANT ist der wissenschaftliche Anker (Prä/Post). |
| **Trainingsumfang** | **Alle ~8 Rueda-Übungen** | Side, Chase, Maze, Anticipation (visible/invisible), Discrimination (portrait/delay), Number, Number-Stroop, Farmer (Go/No-Go). |
| **Eingabegerät** | **Tastatur + Arcade** | Kein Touch-First. Eingabe-Abstraktion muss Tastatur **und** Arcade-Joystick + Arcade-Buttons sauber bedienen. Latenz-arm für RT-Genauigkeit. |
| **Altersgruppen** | **4 und 6 Jahre** | Zwei feste Kohorten wie im Original. **6-Jährige** absolvieren zusätzlich die **Farmer-Übung** (10 statt 9 Übungen). Alter steuert Übungsset, Schwierigkeit, Auswertungs-Normen. |

**Wissenschaftliche Grundregel (durchgehend):**
Die **Tests (ANT)** müssen visuell minimal, standardisiert und reaktionszeit-rein bleiben.
Das **Training** darf reich, verspielt und belohnend sein. Diese Grenze niemals verwischen.

---

## 1. Bestandsaufnahme (Ist-Zustand)

**Stack:** React 19, Vite 8, Tailwind 4, Firebase (Auth E-Mail/Google + Firestore). Kein TypeScript, keine Tests, keine Firestore-Rules, **keine `.env`** (App verbindet aktuell nicht mit Firebase).

**Vorhanden & brauchbar:**
- `src/components/ChildANT.jsx` — funktionierender Child ANT: Cues (none/central/double/spatial), Flanker (neutral/congruent/incongruent), Position top/bottom, 1 Übungsblock (24) + 3 Testblöcke (je 48 = 144 Trials). Scoring alerting/orienting/conflict per **Median-RT korrekter Trials** ist **wissenschaftlich korrekt angelegt**.
- `src/components/TrainingGrid.jsx` — „Side Exercise" (7 Level, Gitter, Gras/Schlamm), 21 Trials.
- `src/components/MazeExercise.jsx` — Maze (nur **3** statt 6 Level), 9 Trials.
- `src/utils/useInput.js` — Eingabe-Hook: Tastatur-Pfeile + Gamepad (Analog, D-Pad, Arcade-Buttons inkl. Speedlink-Mapping). Gute Basis für Arcade.
- `src/components/Fish.jsx`, `HoldToExit.jsx` (3-Sek-Halten zum Beenden = Kindersicherung).
- `src/contexts/AuthContext.jsx`, `src/components/Login.jsx` — Firebase-Auth funktionsfähig.
- `src/services/firebaseService.js` — speichert in **flache** `testResults`-Collection; berechnet `nextSessionDay`.

**Zentrale Lücken:**
1. **Kein `.env` / keine Firebase-Konfig-Vorlage** → App startet nicht produktiv. Keine Firestore-Security-Rules (kritisch: Kinderdaten!).
2. **Kein Pre/Post-Modell.** ANT ist nicht als Einstufung (Baseline) vs. Validierung (Post) modelliert; keine Effekt-Auswertung.
3. **Kinder = frei getippter String** pro Sitzung. Keine Kinder-Verwaltung, keine Auswahl, **kein Alter** (wissenschaftlich zwingend).
4. **Dashboard = einfache Tabelle.** Keine Visualisierung des Trainingseffekts, kein Export.
5. **Nur 3 von ~8 Trainingsübungen**, davon Maze verkürzt.
6. **Timing-/RT-Genauigkeit** setzt auf `setTimeout` (Jitter). Für „wissenschaftlich" ungenügend.
7. **Kein TypeScript, keine Schema-Validierung, keine Tests.**

---

## 2. Zielarchitektur

```
src/
  app/                     App-Shell, Routing/View-State, Session-Orchestrierung
  auth/                    AuthContext, Login (bestehend, leicht angepasst)
  children/                Kinder-CRUD + Auswahl (Teil 2)
  assessment/
    ant/                   Child ANT (gehärtet), Scoring, Trial-Generator
    AssessmentRunner.tsx   Baseline/Post-Orchestrierung
  training/
    engine/                ExerciseEngine (config-getrieben): Timing, Level-Logik, Logging
    exercises/             1 Ordner je Übung (8+1)
  dashboard/               Auswertung, Charts, Export (Teil 1)
  platform/
    input/                 Eingabe-Abstraktion (Tastatur + Arcade)
    timing/                RT-/Onset-Engine (rAF + performance.now)
    rng/                   Seeded RNG (reproduzierbar)
  data/
    schema/                zod-Schemas aller persistierten Objekte
    firestore/             typisierte Repositories (children, assessments, sessions)
  ui/                      geteilte kindgerechte UI-Bausteine, Sound, Animation
```

**Technische Grundsatzentscheidungen (empfohlen, umzusetzen):**
- **TypeScript einführen**, inkrementell. Alle **neuen** Module in TS. Bestehende JSX-Dateien schrittweise migrieren (Reihenfolge: `data/` → `platform/` → `assessment/` → Rest).
- **zod** an der Firestore-Grenze: jedes gelesene/geschriebene Dokument wird validiert → Datenintegrität für die Auswertung.
- **Vitest + React Testing Library**: Pflicht-Tests für alle wissenschaftlich relevanten Berechnungen (ANT-Scoring, Median, Exclusion-Regel, Level-Advancement, RNG-Determinismus).
- **Server-Timestamps** (`serverTimestamp()`) für alle Zeitstempel; zusätzlich client-seitige `performance.now`-basierte RTs.

---

## 3. Datenmodell (Firestore)

Von flacher `testResults`-Collection auf **verschachtelte, pfad-abgesicherte** Struktur umstellen:

```
users/{uid}                                     (Betreuer-Profil, optional)
  children/{childId}                            Kind-Profil
    assessments/{assessmentId}                  ein ANT-Lauf (Baseline/Post/Interim)
    trainingSessions/{sessionId}                ein Trainingstag
```

**`children/{childId}`**
```ts
{
  displayName: string,           // Anzeigename/Pseudonym (Datenschutz: kein Klarname nötig)
  ageGroup: 4 | 6,               // steuert Übungsset & Normen
  birthMonth?: string,           // optional 'YYYY-MM' für Altersberechnung
  sex?: 'm' | 'f' | 'x',
  studyGroup?: 'trained' | 'control',  // für Vergleiche im Dashboard
  createdAt: Timestamp,
  archived: boolean
}
```

**`assessments/{assessmentId}`** (ein Child-ANT-Lauf)
```ts
{
  phase: 'baseline' | 'post' | 'interim',
  timestamp: Timestamp,
  ageGroupAtTest: 4 | 6,
  rngSeed: string,                         // Reproduzierbarkeit
  config: { practiceTrials, testBlocks, trialsPerBlock, timings },
  scores: {
    overallRT: number,                     // Median RT korrekter Trials
    conflictRT: number,                    // incongruent − congruent (Median)
    alertingRT: number,                    // no-cue − double-cue
    orientingRT: number,                   // center-cue − spatial-cue
    overallErrorRate: number,              // %
    accuracyByCondition: {...}
  },
  quality: {
    excluded: boolean,                     // true wenn Fehlerrate > 40 %
    reason?: string,
    validTrialCount: number
  },
  rawTrials: Trial[]                        // vollständiges Trial-Log (s. §5.1)
}
```

**`trainingSessions/{sessionId}`** (ein Tag)
```ts
{
  sessionDay: 1..5,
  timestamp: Timestamp,
  ageGroupAtTest: 4 | 6,
  exercises: [{
    exerciseId: string,                    // 'side' | 'chase' | 'maze' | ...
    levelsCompleted: number,
    highestLevel: number,
    trials: number,
    correct: number, errors: number, missed: number,
    trialToAdvanceRate: number,            // vgl. Studie Tabelle 1
    durationMs: number,
    perLevel: [{ level, trials, correct, errors }],
    rawEvents?: ExerciseEvent[]            // optional, für Detailanalyse
  }]
}
```

**Firestore-Security-Rules** (`firestore.rules`): Zugriff nur, wenn `request.auth.uid == uid` im Pfad. Kinderdaten strikt an Besitzer gebunden. Dazu `firebase.json` + `.firebaserc` anlegen. Rules mit dem Firestore-Emulator testen.

**Migration:** Bestehende `testResults`-Dokumente sind Testdaten → kein produktiver Migrationspfad nötig. Optional Einmal-Skript zum Aufräumen. Neue Struktur ist Quelle der Wahrheit.

---

## 4. Teil 2 — Mehrere Kinder unter einem Betreuer-Login

**Warum zuerst (nach Infrastruktur):** Alles Weitere (Tests, Training, Auswertung) ist pro Kind skopiert. Dieses Fundament schaltet die restliche Arbeit frei.

**Umzusetzen:**
1. **Kinder-Verwaltung** (`children/`): Liste, Anlegen, Bearbeiten, Archivieren.
   Felder: Anzeigename/Pseudonym, **Altersgruppe (4|6)**, optional Geschlecht, Studiengruppe (trained/control).
2. **Kinder-Auswahl-Screen** ersetzt den frei-Text `SessionStartScreen`.
   Kindgerecht: große Avatar-Karten (Tier/Farbe je Kind), Tastatur-/Arcade-navigierbar.
3. **Skopierung:** Nach Auswahl ist ein `childId` aktiv; alle Reads/Writes laufen unter
   `users/{uid}/children/{childId}/...`.
4. **Fortschritt pro Kind:** „Baseline erledigt?", „nächster Trainingstag (1–5)", „Post fällig?"
   aus den Subcollections berechnen (ersetzt `getChildProgress`).
5. **Altersgruppe wirkt:** 6-Jährige → Farmer-Übung im Trainingsset; 4-Jährige → ohne.

**Abnahme:** Betreuer legt 2 Kinder (4 & 6) an, wählt eines, sieht dessen Fortschritt; Daten landen unter dem korrekten Pfad; Rules verhindern Fremdzugriff (Emulator-Test).

---

## 5. Teil 1 — Einstufungs- & Validierungstest + Dashboard

### 5.1 Child ANT wissenschaftlich härten

Der bestehende `ChildANT.jsx` ist eine gute Basis. Erforderliche Präzisierungen (Standard: **Rueda et al. 2004, Neuropsychologia 42:1029–1040** — kanonischer Child ANT; gegen diese Quelle verifizieren):

**Struktur (beibehalten/bestätigen):**
- 5 Fische in horizontaler Reihe, erscheint **ober- oder unterhalb** der Fixation (Orienting-Manipulation ✓).
- Reaktion: Richtung des **mittleren** Fischs (links/rechts).
- Cues: no-cue, center-cue, double-cue, spatial-cue.
- Flanker: congruent, incongruent (+ neutral).
- Übung: 24 Trials mit Feedback. Test: **3 × 48 = 144 Trials**.

**Timing an Kanon angleichen (verifizieren):**
- Fixation variabel **400–1600 ms** (vorhanden ✓).
- Cue **150 ms** (vorhanden ✓).
- Post-Cue-Fixation **450 ms** (aktuell 400 → auf 450 korrigieren; gegen Quelle prüfen).
- Target bis Antwort, **max. 1700 ms** (vorhanden ✓).
- Post-Target-Intervall so, dass Gesamt-Trial konstant ist (kanonisch ~4050 ms; `d4 = total − d1 − RT`). Ergänzen.

**Reaktionszeit-Reinheit (kritisch für „wissenschaftlich"):**
- Stimulus-**Onset** nach dem tatsächlichen Paint erfassen (rAF-Callback nach Target-Render), nicht per `setTimeout` annehmen. RT = `responseTime − paintedOnset` via `performance.now()`.
- Phasenübergänge nicht ausschließlich auf `setTimeout` verlassen (Jitter dokumentieren/minimieren) → zentrale **Timing-Engine** (`platform/timing/`).
- **Feedback im Testblock:** Standard-Child-ANT gibt Kindern Feedback; für RT-Reinheit jedoch **im Testblock kein reaktionszeit-veränderndes Per-Trial-Feedback** (Post-Error-Slowing vermeiden). Empfehlung: Feedback **nur im Übungsblock**; im Test nur **block-weise** Belohnung. *(Default so umsetzen; von Fachperson bestätigen lassen.)*

**Scoring (weitgehend vorhanden, ergänzen):**
- Median-RT **korrekter** Trials je Bedingung (vorhanden ✓).
- `conflict = incongruent − congruent`, `alerting = no-cue − double-cue`, `orienting = center-cue − spatial-cue` (vorhanden ✓).
- **Exclusion-Regel** ergänzen: Fehlerrate **> 40 %** → `quality.excluded = true` (Studie schließt solche Kinder aus).
- **Vollständiges Trial-Log** speichern (`rawTrials`): pro Trial `{index, block, cue, flanker, position, targetDir, responseDir, correct|null, rt, onsetTs}`.

**Reproduzierbarkeit:** Seeded RNG (`platform/rng/`) je Assessment; Seed speichern. Counterbalancing der Reihenfolge dokumentieren.

### 5.2 Assessment-Orchestrierung (Einstufung vs. Validierung)

- **Einstufungstest (Baseline):** ANT **vor** Trainingstag 1. Eigener, gegateter Schritt (`phase:'baseline'`).
- **Validierungstest (Post):** ANT **nach** Trainingstag 5 (`phase:'post'`).
- Optional **Interim** möglich (`phase:'interim'`), Standard aus.
- Der Session-Orchestrator plant je nach Kind-Fortschritt: fehlt Baseline → zuerst Baseline-ANT; nach Tag 5 → Post-ANT.
- Jeder Lauf wird als eigenes `assessments`-Dokument gespeichert (mit `phase`, `scores`, `quality`, `rawTrials`).

**Abnahme:** Baseline- und Post-ANT werden korrekt gescored, als getrennte Dokumente gespeichert; ausgeschlossene Läufe sind als solche markiert; RTs plausibel (Größenordnung wie Studie: 4-J. ~1500–1900 ms, 6-J. ~900–1100 ms overall).

### 5.3 Dashboard (Auswertung)

Pro Kind, mit klarer Darstellung des **Trainingseffekts** (Kern der Fragestellung „was bringt das Training"):

1. **Prä-vs-Post-Vergleich** (Balken/Slope) für: Conflict-RT, Overall-RT, Error-Rate, Alerting, Orienting — mit **Δ** und **%-Änderung** (analog Studie Tabelle 2/3).
2. **Trainingsverlauf über 5 Tage:** absolvierte Übungen, erreichte Level, Trial-to-Advance-Rate, Fehler-/Miss-Rate (analog Studie Tabelle 1).
3. **Trial-Verteilungen:** RT-Histogramme congruent vs. incongruent (Transparenz/Datenqualität).
4. **Gruppenvergleich** (falls `studyGroup` genutzt): trained vs. control.
5. **Datenexport:** Roh-Trials + Scores als **CSV/JSON** herunterladbar (essenziell für externe statistische Auswertung).

Für die Charts das **`dataviz`-Skill** nutzen (konsistente, barrierefreie Palette, Light/Dark). Keine externen Chart-CDNs, wenn als Artifact/SVG.

**Abnahme:** Nach einem Kind mit Baseline + 5 Trainingstagen + Post zeigt das Dashboard eine korrekte Prä/Post-Effektdarstellung und exportiert vollständige Rohdaten.

---

## 6. Teil 3 — Trainingsprogramm (alle Übungen) + Game-Feel

### 6.1 Geteilte ExerciseEngine

Eine config-getriebene Engine (`training/engine/`), die **alle** Übungen mit einheitlicher Mechanik versorgt:
- **Level-Advancement:** je Übung `levels a`, `min trials b`, `advance criterion c` (c korrekte in Folge → nächstes Level).
- Einheitliches **Trial-Logging**, **Timing**, **Feedback**, **HoldToExit**, **Sound/Animation-Hooks**.
- Einheitliche **Eingabe** über `platform/input/` (Tastatur + Arcade). Bewegungen: 8-Wege für Navigations-Übungen; binäre/knopfbasierte Antworten für Wahlaufgaben.
- Ergebnis pro Übung im `trainingSessions`-Schema (§3).

### 6.2 Die Übungen mit exakten Studienparametern

`a` = Anzahl Level, `b` = Mindest-Trials zum Abschluss, `c` = Trials-to-Advance-Kriterium (aus Rueda 2005, Training Program).

| # | Übung | a | b | c | Trainingsziel | Mechanik / Feel |
|---|---|---|---|---|---|---|
| 1 | **Side** | 7 | 21 | 3 | Motorische Kontrolle | Katze auf Gras bewegen, Schlamm meiden; **Gras schrumpft** pro Level. *(vorhanden — auf Schrumpf-Mechanik über 7 Level angleichen)* |
| 2 | **Chase** | 7 | 21 | 3 | Verfolgung/Sustained | Bewegenden Regenschirm fangen, Katze trocken halten. *(NEU — Pursuit-Tracking)* |
| 3 | **Maze** | 6 | 6 | 1 | Antizipation/Planung | Katze durch Labyrinth zum Futter. *(vorhanden mit 3 Level → auf 6 Level, c=1 erweitern)* |
| 4 | **Anticipation** | 7 | 21 | 3 | Antizipatorische Aufmerksamkeit | Auftauchpunkt einer Ente vorhersagen, Katze dorthin. **Zwei Varianten:** Ente sichtbar / unter Wasser unsichtbar. *(NEU)* |
| 5 | **Discrimination** | 7 | 21 | 3 | Arbeitsgedächtnis/Selektion | Multiattribut-Portrait merken, aus Array wählen. **Zwei Varianten:** Vorlage bleibt / Vorlage verschwindet (Delay). *(NEU)* |
| 6 | **Number** | 5 | 45 | 9 | Symbol-Matching | Arabische Ziffer aus zwei Sets korrekt zuordnen. *(NEU)* |
| 7 | **Number-Stroop** | 6 | 18 | 3 (inkongr.) | **Konfliktlösung (exek. Kern)** | Größere Menge wählen; Konflikt: Menge vs. Ziffernwert (z. B. sieben „2" vs. zwei „9"). Frühe Level: Äpfel; später Ziffern. *(NEU)* |
| 8 | **Farmer (Go/No-Go)** | 7 | 66 | 6 (≥1 No-Go) | **Inhibitionskontrolle** | Schaf = klicken (Go), Wolf = zurückhalten (No-Go); Wolf im Schafspelz; höhere Level: Schaf wird nach Intervall zum Wolf. **Nur 6-Jährige.** *(NEU)* |

**5-Tage-Sequenzierung:** Übungen über 5 Tage verteilen (Studie: ~9 Übungen für 4-J., ~10 für 6-J.; im Schnitt 6.8 bzw. 9.3 Übungen abgeschlossen). Scheduler (`app/`) reiht pro Tag/Alter die passenden Module; 6-J. inkl. Farmer. Reihenfolge dokumentieren; progressive Schwierigkeit.

### 6.3 Game-Feel („Mario-Kart"-Niveau) — nur Training

- **Konsistente Art-Direction:** freundliches Katzen-Maskottchen, Welt-Thema, weiche Animationen, Partikel/Juice bei Erfolg, Level-Up-Belohnungen, Sterne/Fortschritt.
- **Sound** mit Mute-Option; **kein** Ton, der Reaktionszeiten im **Test** beeinflusst (Test bleibt clean).
- **Arcade-Feel:** reaktive Steuerung, passende Input-Repeat-/Latenzwerte, klare Trefferrückmeldung.
- **Kindersicherung:** `HoldToExit` beibehalten/erweitern; keine versehentlichen Abbrüche.
- **Belohnungsschleifen** zwischen Übungen (Sammel-/Fortschrittsmeta), ohne die Trial-Struktur der Übungen wissenschaftlich zu verfälschen.

**Abnahme:** Alle 8 Übungen (6-J.) bzw. 7 (4-J.) über 5 Tage spielbar mit Tastatur **und** Arcade; Level-Advancement entspricht den `a/b/c`-Parametern; jede Sitzung erzeugt ein vollständiges `trainingSessions`-Dokument; Übungen fühlen sich flüssig und belohnend an.

---

## 7. Querschnitt: Wissenschaftliche Strenge (Checkliste)

- [ ] **RT-Onset** post-paint via rAF + `performance.now()` (nicht `setTimeout`-Annahme).
- [ ] **Seeded RNG** je Assessment; Seed persistiert (Reproduzierbarkeit/Counterbalancing).
- [ ] **ANT-Struktur** fix: 24 Übung + 3×48 Test; Median-RT korrekter Trials; **Exclusion > 40 %**.
- [ ] **Feedback-Politik** dokumentiert (Übung ja, Test nein) — von Fachperson bestätigen.
- [ ] **Vollständiges Trial-/Event-Log** je Assessment und Trainingssitzung.
- [ ] **zod-Validierung** an der Firestore-Grenze; **Server-Timestamps**.
- [ ] **Atomare Speicherung** (kein Teil-Write); Offline-Resilienz (Write-Queue) sinnvoll.
- [ ] **Tests** für Scoring, Median, Exclusion, Advancement, RNG-Determinismus (Vitest).
- [ ] **Altersabhängigkeit** korrekt (Farmer nur 6-J.; Normbereiche je Alter im Dashboard).

---

## 8. Nicht-funktionale Anforderungen

- **Datenschutz:** Pseudonyme statt Klarnamen ermöglichen; Kinderdaten strikt betreuer-gebunden (Rules). Keine PII in URLs.
- **Barrierefreiheit & Robustheit:** klare Ladezustände, Fehlerbehandlung, Wiederaufnahme abgebrochener Sitzungen.
- **Konfiguration:** `.env.example` mit allen `VITE_FIREBASE_*`-Keys; README-Setup (Firebase-Projekt, Emulator, Rules-Deploy).
- **Build-Modi** (`build:qual`, `build:prod`) bereits vorhanden → env-Trennung nutzen.

---

## 9. Phasenplan (empfohlene Reihenfolge für das ausführende Modell)

**Phase 0 — Fundament**
`.env.example` + Firebase-Setup dokumentieren · `firestore.rules` + `firebase.json` + `.firebaserc` · TypeScript einführen · `data/schema` (zod) + typisierte Repositories · `platform/input` (Tastatur+Arcade) · `platform/timing` (RT-Engine) · `platform/rng` · Vitest-Setup.

**Phase 1 — Teil 2: Kinder-Verwaltung & -Auswahl**
Children-CRUD · Auswahl-Screen (ersetzt Frei-Text) · Skopierung aller Reads/Writes · Fortschritt pro Kind · Altersgruppe wirksam.

**Phase 2 — Teil 1a: ANT-Härtung & Assessment-Modell**
ANT auf Timing-Engine/RNG umstellen · Onset-genaue RTs · Exclusion-Regel · Baseline/Post-Orchestrierung · Speicherung als `assessments` inkl. `rawTrials`.

**Phase 3 — Teil 1b: Dashboard & Export**
Prä/Post-Effektansicht · Trainingsverlauf · RT-Histogramme · CSV/JSON-Export · (dataviz-Skill).

**Phase 4 — Teil 3a: ExerciseEngine + alle Übungen**
Engine (a/b/c-Logik, Logging) · Side/​Maze angleichen · Chase, Anticipation (2), Discrimination (2), Number, Number-Stroop, Farmer neu · 5-Tage-Scheduler (alters­abhängig).

**Phase 5 — Teil 3b: Game-Feel-Politur**
Art-Direction, Animation, Sound, Belohnungen, Arcade-Feel — nur Training, Test bleibt clean.

**Phase 6 — Validierung**
End-to-End-Pilotlauf (1 Kind je Alter: Baseline → 5 Tage → Post) · Datenqualität prüfen · Testsuite grün · Rules im Emulator geprüft.

---

## 10. Referenz: Studien-Kennzahlen zur Plausibilisierung

Zur Validierung der eigenen Daten (Größenordnungen, nicht als Zielwert):

- **Overall-RT** (ANT): 4-J. ~1500–1900 ms, 6-J. ~900–1100 ms.
- **Conflict-Score** (incongr − congr): 4-J. ~130–260 ms, 6-J. ~34–86 ms (Erwachsene ~30 ms).
- **Fehlerrate:** 4-J. ~12–18 %, 6-J. ~2–3 %. Ausschluss bei **> 40 %**.
- **Trainingseffekt** (Studie): ca. **halb so groß** wie der Entwicklungssprung von 4→6 J.; am deutlichsten in Konflikt-Score und Matrizen-IQ (IQ hier nicht gemessen).
- **Trainingsphase** (Tabelle 1): abgeschlossene Übungen 6.8 (4-J.) / 9.3 (6-J.); Trial-to-Advance-Rate ~4–5.5.

---

*Quelle: Rueda, M. R., Rothbart, M. K., McCandliss, B. D., Saccomanno, L., & Posner, M. I. (2005). PNAS 102(41), 14931–14936. Kanonischer Child ANT: Rueda et al. (2004), Neuropsychologia 42, 1029–1040.*
