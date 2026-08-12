# Fix-Plan Testrunde 1 (lokales Testen, 2026-07-20)

Beim lokalen Testen wurden 6 Probleme gefunden. Dieses Dokument enthält die
**geklärten Ursachen** und einen **schrittweisen Arbeitsplan** (AP1–AP7) für das
ausführende Modell. Konventionen aus `CLAUDE.md` und `docs/IMPLEMENTATION_PLAN.md`
gelten unverändert (TypeScript, zod an der Firestore-Grenze, Vitest-Pflicht für
wissenschaftliche Logik, deutsche UI-Sprache).

**Empfohlene Reihenfolge: AP1 → AP2 → AP3 → AP4 → AP5 → AP6 → AP7.**
AP1–AP2 sind kleine, isolierte Bugfixes; AP3–AP5 ändern Übungsverhalten;
AP6 ist das größte Paket (Persistenz/Resume); AP7 verifiziert alles.

---

## 0. Studienrecherche (Grundlage für AP4/AP5, verifiziert am 2026-07-20)

Quelle: Rueda et al. (2005), PNAS 102(41):14931–14936, Abschnitt *Training
Program* im Volltext (https://www.pnas.org/doi/10.1073/pnas.0506897102).
Paraphrasierte Kernaussagen:

- **Side:** Katze per Joystick auf Gras bewegen, Schlamm meiden. Zu Beginn ist
  Gras **an allen vier Bildschirmrändern**; mit steigendem Level **wächst die
  Schlammfläche und die Grasfläche schrumpft** — das ist die gesamte
  Schwierigkeitsmechanik. **Kein Labyrinth, kein einzelner Ausgang.**
- **Maze:** Katze durch ein Labyrinth zum Futter bewegen (a=6, b=6, c=1). Die
  Studie beschreibt **keine** Mechanik „Wandberührung = Fehler/Trial-Abbruch";
  es geht um Antizipation/Planung des Weges, nicht um Präzisionssteuerung.
- **Discrimination (zwei Varianten):** In der einfachen Variante **bleibt die
  Vorlage während der Auswahl sichtbar**. In der Delay-Variante **verschwindet
  die Vorlage, bevor das Auswahl-Array erscheint** — das Kind muss die
  Attribute memorieren. Die Vorlage darf in der Delay-Variante also während
  der Auswahl **nicht** wieder auftauchen.
- Chase (Schirm fangen), Anticipation (Ente sichtbar/unsichtbar), Number,
  Number-Stroop, Farmer: wie im Plan §6.2 bereits umgesetzt beschrieben.

---

## 1. Befunde (Ursachen der 6 gemeldeten Probleme)

### Befund A — Erster richtiger Versuch zählt 2 Sterne (Chase; auch Anticipation)

**Ursache:** `endTrial` wird **innerhalb von React-State-Updater-Funktionen**
aufgerufen. `main.jsx` rendert unter `<StrictMode>`; StrictMode ruft Updater im
Dev-Modus **doppelt** auf, um Unreinheit aufzudecken → `recordTrial` feuert 2×
pro Trial → Streak +2, `perLevel`-Statistik verdoppelt Trials, Level-Aufstieg
zu früh. Genau das ist der beobachtete „2-Sterne"-Effekt.

Betroffene Stellen (Side-Effekt im Updater):
- `src/training/exercises/chase/ChaseExercise.tsx:139` (`endTrial` in `setCatPos`-Updater)
- `src/training/exercises/chase/ChaseExercise.tsx:112–123` (`endTrial` in `setRemainingMs`-Updater)
- `src/training/exercises/anticipation/AnticipationExercise.tsx:128–134` (`endTrial` in `setLane`-Updater)
- `src/training/exercises/anticipation/AnticipationExercise.tsx:98–119` (`endTrial` in `setElapsedMs`-Updater)

**Nicht betroffen:** Side, Maze, Number, Number-Stroop, Discrimination (Aufruf
aus Event-Handlern mit Guard) und Farmer (sauberes `respondedRef`-Muster,
`FarmerExercise.tsx:70–74` — als Vorbild verwenden).

Hinweis: Im Produktions-Build tritt die Verdopplung so nicht auf, aber die
Updater-Unreinheit ist ein echter Bug (Race Timer↔Bewegung kann auch in Prod
doppelt feuern). **StrictMode eingeschaltet lassen** und die Ursache beheben.

### Befund B — Side ist ein Labyrinth statt „wachsender Schlamm"

`src/training/exercises/side/maps.ts`: Level 2–7 sind Korridor-Labyrinthe mit
genau einem Weg zum Gras — das dupliziert die Maze-Übung und widerspricht der
Studie (Befund §0). Die Nutzer-Skizze entspricht der Studie: **grauer sicherer
Untergrund, braune Schlammflecken, die pro Level wachsen, grüne Grasflächen als
Ziel, mehrere mögliche Wege.**

### Befund C — Levels sind NICHT deterministisch

- `src/training/TrainingSessionRunner.tsx:56`: `sessionSeed = generateSeed()`
  → **zufälliger UUID pro Sitzung**. Jedes Kind/jeder Lauf bekommt andere
  Trial-Sequenzen in Chase, Anticipation, Discrimination, Number,
  Number-Stroop, Farmer.
- `src/App.tsx:118`: Standalone-Übungen ebenfalls `generateSeed()`.
- Side und Maze sind durch statische `LEVEL_MAPS` bereits deterministisch.
- Zusatzproblem: Die Übungen ziehen aus **einem fortlaufenden RNG-Strom**
  (`rngRef`). Bei Chase ist die Anzahl RNG-Züge pro Trial laufzeitabhängig
  (Schirm-Schritte bis zum Fang) → selbst mit festem Seed wären Trial n+1 ff.
  von der Performance des Kindes abhängig. Außerdem verbraucht der doppelte
  Effekt-Lauf unter StrictMode (Dev) zusätzliche Züge → Dev ≠ Prod.

### Befund D — Kein Absturz-Schutz, Speichern erst am Tagesende

- `TrainingSessionRunner.save()` schreibt **ein einziges Dokument am Ende des
  gesamten Trainingstags** (`addTrainingSession`). Crash/Reload mittendrin =
  kompletter Fortschritt weg.
- Es gibt **keinen ErrorBoundary** (weder `main.jsx` noch `App.tsx`) — ein
  Renderfehler wirft die App komplett aus der Sitzung.
- `firestore.rules` verbietet `update` auf `trainingSessions` → inkrementelles
  Speichern erfordert eine Rules-Anpassung.
- `src/data/progress.ts` zählt jedes Session-Dokument als abgeschlossenen Tag
  → In-Progress-Dokumente müssen beim Zählen ausgenommen werden.

### Befund E — Maze mit Joystick unverzeihlich

`src/training/exercises/maze/maps.ts` + `MazeExercise.tsx`: Wege sind 1 Tile
breit, **jede Wandberührung beendet den Trial als Fehler** und setzt an den
Start zurück; zusätzlich erlaubt `useDirectionalInput` 8-Wege-Bewegung — ein
leicht schräg gehaltener Joystick erzeugt Diagonalschritte in die Wand. Die
Studie gibt diese Bestrafung nicht her (Befund §0): dort wird die Katze durch
das Labyrinth geführt; die Wand ist Begrenzung, nicht Falle.

Prüfung der anderen Spiele auf dasselbe Problem:
- **Side:** Schlamm = Fehler ist studienkonform (Meiden ist die trainierte
  Fähigkeit), wird aber erst mit dem Redesign (AP5, offene Flächen) fair.
  Die Diagonal-Eck-Kollisionsregel (`SideExercise.tsx:42–50`) ist ein
  Workaround für die Korridor-Maps und entfällt mit AP5.
- **Chase/Anticipation:** keine Gefahren-Tiles, Diagonalen helfen → ok.
- **Discrimination/Number/Number-Stroop/Farmer:** Auswahl-/Button-basiert → ok.

### Befund F — Discrimination-Delay zeigt die Vorlage bei der Auswahl wieder an

`src/training/exercises/discrimination/DiscriminationExercise.tsx:120`:
`{phase !== 'delay' && trial && …}` rendert die Vorlage auch in der Phase
`'choose'` — nach dem Delay taucht sie also wieder auf. Laut Studie muss sie in
der Delay-Variante verschwunden bleiben. Die Variante **ohne** Delay ist
korrekt (Vorlage bleibt sichtbar). Ein-Zeilen-Bedingungsfehler.

---

## 2. Arbeitspakete

### AP1 — Doppelzählung beheben (Chase + Anticipation), Trial-Abschluss härten

**Ziel:** `recordTrial` feuert exakt einmal pro Trial — in Dev (StrictMode),
Prod und bei Races (Timer läuft ab, während eine Bewegung verarbeitet wird).

1. Kleines pures Modul `src/training/engine/trialGate.ts` anlegen:
   `createTrialGate()` mit `tryClose(): boolean` (erste Schließung gewinnt,
   weitere geben `false` zurück) und `reset()`. Vitest-Tests dazu.
2. **ChaseExercise:** Katzenposition zusätzlich in einem Ref führen
   (`catPosRef`, analog `targetPosRef`). `handleMove` berechnet die neue
   Position **außerhalb** des Updaters aus `catPosRef`, ruft danach
   `setCatPos(next)` und — falls Ziel erreicht — `endTrial(true)` als normale
   Anweisung im Handler auf. Timer: verbleibende Zeit in einem Ref mitführen;
   der `setInterval`-Callback dekrementiert das Ref, ruft `setRemainingMs`
   nur zur Anzeige auf und löst `endTrial(false)` außerhalb eines Updaters
   aus. `endTrial` beginnt mit `if (!gate.tryClose()) return;`; das Trial-
   Setup-Effect ruft `gate.reset()` auf.
3. **AnticipationExercise:** identisches Muster — `elapsedMs` in Ref,
   `endTrial`-Aufrufe aus den Updatern von `setLane`/`setElapsedMs`
   herausziehen, Gate einbauen.
4. Defensiv: dasselbe Gate-Muster in Side/Maze/Discrimination/Number/
   Number-Stroop einbauen (ersetzt die reinen `flash`-Guards, die auf
   asynchronem State beruhen). Farmer hat es de facto (`respondedRef`) —
   optional auf `trialGate` umstellen, Verhalten unverändert.
5. **Kein** Entfernen von `<StrictMode>` — er hat den Bug korrekt aufgedeckt.

**Abnahme:** Im Dev-Server (StrictMode aktiv) füllt der erste korrekte Trial in
Chase/Anticipation genau 1 Stern; `perLevel[0].trials` zählt 1 pro Versuch.
Vitest grün.

### AP2 — Discrimination-Delay: Vorlage bleibt verschwunden

1. In `DiscriminationExercise.tsx` die Anzeigebedingung der Vorlage ändern:
   sichtbar nur bei `phase === 'study'` **oder** `!hasDelay`. In der
   Delay-Variante zeigt die Phase `'choose'` an der Vorlagen-Position nichts
   (oder weiterhin das ❓ aus der Delay-Phase — Entscheidung frei, Hauptsache
   keine Vorlage).
2. Variante ohne Delay unverändert lassen (Vorlage bleibt während der Auswahl
   sichtbar — studienkonform).
3. RTL-Komponententest: bei `hasDelay=true` ist in der Choose-Phase kein
   Template-Portrait im DOM; bei `hasDelay=false` schon.

**Abnahme:** Delay-Variante: Vorlage → Delay (❓) → Auswahl ohne Vorlage.

### AP3 — Deterministische Level/Trial-Sequenzen für alle

**Entscheidungen (so umsetzen):**
- Trainings-Seed ist eine **feste Konstante**, nicht mehr zufällig:
  `sessionSeed = "mindcat-v1:day{sessionDay}"`, Übungs-Seed weiterhin via
  `deriveExerciseSeed` → z. B. `mindcat-v1:day3:chase`. Damit sieht **jedes
  Kind an Tag n exakt dieselben Sequenzen**. Der Seed wird unverändert im
  Session-Dokument persistiert (Reproduzierbarkeit bleibt dokumentiert).
- Standalone-Übungen (`App.tsx`) verwenden `"mindcat-v1:practice:{exerciseId}"`
  statt `generateSeed()`.
- **Pro-Trial-Sub-RNG statt fortlaufendem Strom:** In jeder RNG-Übung
  (Chase, Anticipation, Discrimination, Number, Number-Stroop, Farmer) wird
  je Trial `createRng(`${seed}:trial${trialIndex}`)` erzeugt und alle Züge
  dieses Trials (inkl. Schirm-Schritte bei Chase) daraus gezogen. Effekte:
  (a) Trial k ist für alle Kinder identisch, unabhängig davon, wie viele
  Züge frühere Trials verbraucht haben; (b) StrictMode-Doppelläufe der
  Effekte verändern die Sequenz nicht mehr (Dev = Prod); (c) Resume nach
  Absturz (AP6) reproduziert exakt dieselben Trials.
- **ANT bleibt unverändert** (weiterhin `generateSeed()` je Assessment) — die
  Determinismus-Anforderung betrifft die Trainingsspiele.
- Side/Maze: bereits deterministisch über statische Maps, nichts zu tun.

**Tests:** Vitest — zwei Läufe mit gleichem Seed und gleicher Trial-Nummer
liefern identische Generate-Ergebnisse (je Übungs-Generator); unterschiedliche
Trial-Nummern liefern (i. d. R.) unterschiedliche; Seed-Ableitung ist stabil
(Snapshot der ersten 5 Trials für `mindcat-v1:day1:chase`).

**Abnahme:** Zwei frische Sitzungen von Tag 1 (verschiedene Kinder) zeigen
identische Sequenzen (z. B. gleiche erste Schirm-Position in Chase, gleiche
erste Ziel-Spur in Anticipation, gleiche Portraits in Discrimination).

### AP4 — Maze (und Eingabe) entschärfen

**Entscheidungen (so umsetzen):**
1. **Wände blockieren statt bestrafen:** Schritt auf ein Wand-Tile wird nicht
   ausgeführt; kurzes „Bump"-Feedback (leichter Shake/Sound, kein roter
   Fehler-Flash, kein Reset). Der Trial endet ausschließlich mit Erreichen des
   Ziels (`correct`) — konsistent mit a=6, b=6, c=1 (jedes Labyrinth einmal
   lösen).
2. **Wand-Bumps als Rohdaten loggen:** `useExerciseEngine` für Maze mit
   `logRawEvents: true` verwenden; je Bump ein Event
   `{ type: 'wallBump', level, x, y, ts }` — Fehlerauswertung bleibt möglich,
   ohne die Trial-Struktur zu verfälschen.
3. **Maze auf 4-Wege-Eingabe:** Diagonalen ignorieren (in `MazeExercise`
   Bewegungen mit `dx !== 0 && dy !== 0` verwerfen oder `useDirectionalInput`
   um Option `mode: '4-way'` erweitern — Letzteres bevorzugt, da sauber in der
   Eingabe-Abstraktion aufgehoben). Damit ist die Diagonal-Eck-Kollisionsregel
   obsolet → entfernen.
4. Maps in `maze/maps.ts` unverändert lassen (1 Tile Breite ist mit
   blockierenden Wänden kein Problem mehr). Optional-Erweiterung nur falls
   sich das Spielgefühl beim Verifizieren immer noch hakelig anfühlt:
   Korridore auf 2 Tiles verbreitern (dann `maps.test.ts` mitziehen).
5. Instruktionstext anpassen (der Warnhinweis „Joystick-Diagonale erfordert
   Vorsicht" entfällt).

**Abnahme:** Maze ist mit Joystick flüssig lösbar; Wandkontakt stoppt nur die
Bewegung; jedes der 6 Labyrinthe genau 1× lösen schließt die Übung ab;
`rawEvents` enthält die Bumps.

### AP5 — Side-Redesign: wachsender Schlamm statt Labyrinth

**Zielbild (Studie §0 + Nutzer-Skizze):** grauer, sicherer Untergrund;
braune Schlammflecken (unregelmäßige Blobs), die pro Level wachsen/zahlreicher
werden; grüne Grasflächen als Ziel(e). Es gibt **immer mehrere freie Wege**;
die Schwierigkeit kommt vom schrumpfenden Freiraum, nicht von einem Korridor.

1. `side/maps.ts` neu aufbauen (weiterhin statisch = deterministisch,
   `GRID_SIZE` darf bei 10 bleiben):
   - **Level 1:** Gras an allen vier Rändern (wie Studienbeschreibung), kein
     oder kaum Schlamm, Start in der Mitte.
   - **Level 2–7:** Schlammflecken wachsen von wenigen kleinen Blobs zu
     großen Flächen; Grasfläche schrumpft von „ganzer Rand" auf 1–2 kleine
     Randzonen (Level 7). Kein Level darf zum Ein-Weg-Labyrinth entarten:
     Faustregel — von Start aus existieren mindestens 2 disjunkte Pfade zum
     Gras, und ≥ 40 % (L2) bis ≥ 20 % (L7) der Tiles sind sicher begehbar.
   - Tile-Semantik unverändert (0 Pfad, 1 Schlamm, 2 Gras, 3 Start) — Rest
     der Komponente funktioniert weiter.
2. `side/maps.test.ts` erweitern: je Level (a) Start vorhanden, (b) BFS-Pfad
   Start→Gras über sichere Tiles existiert, (c) Schlamm-Tile-Anzahl wächst
   streng monoton über die Level, (d) Gras-Tile-Anzahl fällt monoton,
   (e) Freiraum-Quoten wie oben.
3. `SideExercise.tsx`: Diagonal-Eck-Kollisionsregel entfernen (Fehler nur bei
   tatsächlichem Betreten eines Schlamm-Tiles); Schlamm = Fehler + Reset
   bleibt (studienkonform, trainierte Fähigkeit).
4. Optik an die Skizze angleichen: `path`-Tiles in `GridWorld.tsx`
   (`TILE_CLASS`, `src/training/shared/GridWorld.tsx:44–48`) von Beige auf
   neutrales Grau umstellen **oder** `TILE_CLASS` per Prop übersteuerbar
   machen, damit nur Side grau wird (bevorzugt, um Maze/Chase-Optik nicht
   ungefragt zu ändern). Schlamm-Blobs dürfen gern einen helleren Rand
   bekommen (wie Skizze) — rein kosmetisch, optional.

**Abnahme:** Side fühlt sich an wie die Skizze: offene Fläche, wachsende
Schlammflecken, mehrere Wege zum Gras; Map-Tests grün.

### AP6 — Absturz-Resilienz: inkrementell speichern + fortsetzen

**Ziel:** Jeder abgeschlossene Level-Aufstieg und jede abgeschlossene Übung
überlebt Crash/Reload; ein unterbrochener Trainingstag wird beim nächsten
Start fortgesetzt (gleicher Tag, gleiche Stelle, gleicher Seed).

1. **Schema erweitern** (`src/data/schema/trainingSession.ts`):
   - `status: z.enum(['in-progress','completed']).default('completed')`
     (Default sichert Alt-Dokumente).
   - `checkpoint` optional: `{ exerciseIndex: number, exerciseId,
     engineState: <zod-Spiegel von ExerciseProgressState>, updatedAt }`.
   - `timestamp` bleibt Erstellzeitpunkt; optional `completedAt` ergänzen.
   - `schema.test.ts` erweitern (Alt-Dokument ohne `status` parst als
     `completed`).
2. **Repo** (`trainingSessionsRepo.ts`):
   - `startTrainingSession(uid, childId, input)` → `addDoc` mit
     `status:'in-progress'`, leerem `exercises`, `rngSeed`.
   - `updateTrainingSessionProgress(uid, childId, sessionId, {exercises, checkpoint})`
     → `updateDoc` (zod-validiert, `stripUndefinedDeep`).
   - `completeTrainingSession(...)` → finale Ergebnisse, `status:'completed'`,
     `checkpoint` löschen, `completedAt: serverTimestamp()`.
   - `findInProgressSession(uid, childId)` → jüngstes Dokument mit
     `status == 'in-progress'` (falls mehrere ältere existieren: nur das
     jüngste fortsetzen, ältere beim Start auf `completed`… **nein** — ältere
     verwaiste In-Progress-Dokumente ignorieren; sie zählen nirgends und
     können bleiben).
3. **Rules** (`firestore.rules`): `update` auf `trainingSessions` erlauben,
   solange `resource.data.status == 'in-progress'` (die Abschluss-Transition
   selbst fällt darunter; danach ist das Dokument wieder unveränderlich).
   `delete` bleibt verboten. Emulator-Test ergänzen, falls Test-Setup
   vorhanden; sonst manuell im Emulator prüfen und im PR dokumentieren.
4. **Fortschritt** (`progress.ts` / `useChildrenProgress` / Dashboard):
   In-Progress-Sitzungen zählen **nicht** als abgeschlossene Tage.
   `ProgressSession` um `status` erweitern; `computeChildProgress` filtert.
   `progress.test.ts` erweitern. Dashboard-/Export-Leser
   (`trainingSummary.ts`, `exportData.ts`) prüfen: In-Progress-Sitzungen
   ausblenden oder als „laufend" kennzeichnen (mindestens: nicht als Tag
   werten).
5. **Engine** (`useExerciseEngine.ts` / `exerciseProgress.ts`):
   - `useExerciseEngine` akzeptiert optional `initialState` (Resume) und
     `onLevelUp(state)`-Callback (feuert nach jedem Level-Aufstieg).
   - `exerciseProgress` bleibt pur; keine Verhaltensänderung der a/b/c-Logik.
6. **Runner** (`TrainingSessionRunner.tsx`):
   - Beim Mount: `findInProgressSession` für Kind + Tag → falls vorhanden,
     Resume-Zustand herstellen (Ergebnisliste, Übungsindex, `initialState`
     aus `checkpoint`, `rngSeed` aus dem Dokument); sonst
     `startTrainingSession` aufrufen.
   - Nach jeder abgeschlossenen Übung: `updateTrainingSessionProgress` mit
     der erweiterten Ergebnisliste (Checkpoint zurücksetzen auf nächste
     Übung, Index+1).
   - Bei jedem `onLevelUp`: Checkpoint mit Engine-State schreiben
     (max. ~7 Writes/Übung — unkritisch).
   - Am Tagesende: `completeTrainingSession` (ersetzt heutiges `save`).
     Retry-Screen-Logik beibehalten.
   - `onCancel` (HoldToExit): In-Progress-Dokument **stehen lassen** →
     nächster Start desselben Tages setzt fort. (Der Nutzer wollte genau
     das: nichts geht mehr verloren.)
   - Resume mitten in einer Übung startet die Übung am **Checkpoint-Level**
     (Trials innerhalb des angebrochenen Levels dürfen verloren gehen —
     „jedes erfolgreiche Level gespeichert" ist die Anforderung). Dank AP3
     (Pro-Trial-Seeds ab `totalTrials` des Checkpoints deterministisch
     fortsetzbar; einfachste korrekte Variante: `trialIndex` läuft ab
     `engineState.totalTrials` weiter).
7. **ErrorBoundary:** Klassen-Komponente `src/ui/ErrorBoundary.tsx` um den
   Übungsbereich in `App.tsx` (mindestens um `TrainingSessionRunner` und
   `AssessmentRunner`): kindgerechter Fehler-Screen („Hoppla…"), Button
   „Zurück zum Dashboard", `console.error`-Log des Fehlers. Zusammen mit dem
   inkrementellen Speichern ist ein Crash damit folgenlos: erneutes Starten
   setzt am letzten Checkpoint fort.
8. **Absturz-Ursache beobachten:** Beim Verifizieren (AP7) die Browser-Konsole
   auf Fehler prüfen und gefundene Ursachen als eigene Fixes nachziehen —
   dieser Plan behebt die *Folgen* (Datenverlust) unabhängig davon.

**Abnahme:** Mitten in Übung 2 auf Level 4 die Seite hart neu laden →
„Sitzung starten" setzt bei Übung 2, Level 4, mit identischen Trials fort;
Übung 1 bleibt gespeichert; Dashboard zählt den Tag erst nach echtem Abschluss;
Rules-Update im Emulator verifiziert.

### AP7 — Verifikation (gesamt)

1. `npm run lint` und `npx vitest run` grün.
2. Dev-Server-Durchlauf (StrictMode!): je Übung mindestens 1 Level spielen und
   prüfen: 1 Stern pro korrektem Trial (AP1), Delay-Variante ohne Vorlage
   (AP2), identische Sequenzen bei zwei Kindern (AP3), Maze-Bump statt Fehler
   (AP4), Side-Optik/Verhalten (AP5), Reload-Resume (AP6).
3. Einmal `npm run build` + Preview, um Prod-Verhalten (ohne StrictMode-
   Doppelung) gegenzuprüfen.
4. `docs/IMPLEMENTATION_PLAN.md` §6.2 um eine Notiz zu den hier getroffenen
   Entscheidungen ergänzen (Side-Mechanik, Maze-Blockierung, deterministische
   Seeds, inkrementelle Persistenz) — der Plan bleibt maßgeblich.

---

## 3. Nicht-Ziele dieser Runde

- Keine Änderung am ANT (Timing, Seeds, Scoring) — Tests bleiben clean.
- Keine Änderung der a/b/c-Parameter (§6.2) — wissenschaftlich bindend.
- Kein Touch-Support, keine neuen Übungen.
- `RewardScreen`/`starsForResult` (1–3 Sterne je Übung) ist korrekt und
  unverändert — das „2-Sterne-Problem" war die Streak-Anzeige (Befund A).
