# 4. Wissenschaftliche Spezifikation der Rueda-Übungen & Child ANT

* Status: accepted
* Datum: 2026-10-13

## Kontext und Problemstellung

Die wissenschaftliche Grundlage des Projekts basiert auf **Rueda et al. (2005, PNAS)** (*"Training, maturation, and genetic influences on the development of executive attention"*) sowie dem kanonischen **Child ANT (Rueda et al., 2004, Neuropsychologia)**.
Um wissenschaftlich belastbare, reproduzierbare und vergleichbare Daten zu erheben, müssen Stimuli, Timing, Scoring-Regeln, Schwierigkeitsprogressionen und Kohorten-Zugehörigkeiten verbindlich festgehalten werden.

## Entscheidung

### 1. Scope & Kohorten
* **Alter**: Kohorten 4 und 6 Jahre. 6-Jährige absolvieren zusätzlich die Farmer-Übung (Inhibitionskontrolle).
* **Testbatterie**: Ausschließlich der **Child ANT** (Prä vor Tag 1, Post nach Tag 5).
* **Wissenschaftliche Grundregel**: Tests (ANT) bleiben minimalistisch, standardisiert und reaktionszeit-rein (keine RT-beeinflussenden Sounds/Animationen, Feedback nur im Übungsblock). Das Training ist motivierend und verspielt gestaltet.

### 2. Child ANT Spezifikation
* **Struktur**: 5 Fische horizontal, Stimulus oberhalb oder unterhalb der Fixation.
  * Cues: none, center, double, spatial.
  * Flanker: neutral, congruent, incongruent.
  * Blöcke: 1 Übungsblock (24 Trials mit Feedback) + 3 Testblöcke (je 48 = 144 Trials ohne Per-Trial-Feedback).
* **Timing & Präzision**:
  * Fixation: 400–1600 ms variabel. Cue: 150 ms. Post-Cue-Fixation: 450 ms. Target: max. 1700 ms.
  * RT-Messung: Onset-genau nach tatsächlichem Paint via `requestAnimationFrame` + `performance.now()`.
* **Scoring & Ausschluss**:
  * Median-RT korrekter Trials je Bedingung.
  * Conflict: $RT_{incongruent} - RT_{congruent}$; Alerting: $RT_{no-cue} - RT_{double-cue}$; Orienting: $RT_{center-cue} - RT_{spatial-cue}$.
  * **Exclusion**: Fehlerrate > 40 % führt zum Ausschluss (`quality.excluded = true`).

### 3. Trainingsübungen & Level-Advancement (Rueda-Parameter)
Parameter: `a` = Anzahl Level, `b` = Mindest-Trials zum Abschluss, `c` = Kriterium für Levelaufstieg (korrekte Trials in Folge).

| # | Übung | a | b | c | Spezifikation & Mechanik |
|---|---|---|---|---|---|
| 1 | **Side** | 7 | 21 | 3 | Katze auf Gras bewegen, Schlamm meiden. Offene Fläche (kein Korridor); Gras schrumpft monoton bis Level 7. |
| 2 | **Chase** | 7 | 21 | 3 | Verfolgung: Bewegten Regenschirm fangen, um die Katze trocken zu halten. |
| 3 | **Maze** | 6 | 6 | 1 | 4-Wege-Steuerung. Wände blockieren ohne Bestrafung (Wand-Bumps als `rawEvents`). |
| 4 | **Anticipation** | 7 | 21 | 3 | Auftauchpunkt einer Ente vorhersagen. Varianten: sichtbar vs. unsichtbar (unter Wasser). |
| 5 | **Discrimination**| 7 | 21 | 3 | Multiattribut-Portrait merken. In der Delay-Variante verschwindet die Vorlage vollständig während der Auswahl. |
| 6 | **Number** | 5 | 45 | 9 | Arabische Ziffern aus zwei Mengen zuordnen (Symbol-Matching). |
| 7 | **Number-Stroop** | 6 | 18 | 3 (inkongr.) | Größere Menge wählen; Konflikt zwischen Anzahl und Ziffernwert. Frühe Level mit Früchten, spätere mit Ziffern. |
| 8 | **Farmer** | 7 | 66 | 6 (≥1 No-Go)| Go/No-Go Inhibitionskontrolle: Schaf = Go, Wolf = No-Go. **Nur Kohorte 6 Jahre**. |

### 4. Deterministische Sequenzen & Persistenz
* **Seeded RNG**: Feste Tages-Seeds (`mindcat-v1:day{n}:{exerciseId}`) sorgen dafür, dass alle Kinder identische Bedingungen erhalten. Sub-RNG pro Trial garantiert Unabhängigkeit von vorherigen Zügen und StrictMode-Resilienz.
* **Checkpointing**: Trainingssitzungen starten als `in-progress`. Nach jedem Level-Aufstieg wird ein Checkpoint geschrieben. Bei Abbruch/Reload wird am Checkpoint fortgesetzt. Erst nach dem Tag wird der Status `completed`.

## Konsequenzen
* Alle Implementierungen und künftigen Tickets müssen diese Parameter und Toleranzen zwingend einhalten.
* Verifikation der Logik erfolgt über automatisierte Vitest-Tests.
