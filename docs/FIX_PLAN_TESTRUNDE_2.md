# Fix-Plan Testrunde 2 (Nutzerfeedback & Studienabgleich, 2026-08-11)

Dieses Dokument enthält die **geklärten Ursachen, Studienabgleiche** sowie den **schrittweisen Arbeitsplan (AP1–AP7)** für die zweite Runde an Anpassungen nach dem Nutzerfeedback. 

Konventionen aus `AGENTS.md`, `docs/IMPLEMENTATION_PLAN.md` und `docs/FIX_PLAN_TESTRUNDE_1.md` gelten unverändert (TypeScript, zod an der Firestore-Grenze, Vitest-Pflicht für wissenschaftliche Logik, Zielgruppe 4- und 6-jährige Kinder mit Speedlink Arcade-Joystick oder Tastatur).

---

## 0. Studienrecherche & Beantwortung der Nutzerfragen

Quelle: **Rueda et al. (2005), PNAS 102(41):14931–14936**, Abschnitt *Training Program*.

### 1. Side (Wiese vs. Schlamm)
* **Nutzerbefund:** Die Wiese umschließt aktuell alle 4 Ränder. Startet die Katze nahe am Rand, reicht 1 Schritt zur Wiese, ohne dass Schlamm überquert werden muss.
* **Studienabgleich:** Die Studie beschreibt, dass die Katze über das Feld bewegt werden muss, um Gras an Rändern/Zielen zu erreichen, während Schlammflecken wachsen.
* **Entscheidung (Testrunde 2):** Die Wiese schrumpft auf gezielte **Gras-Felder (z. B. 2×2 Ziel-Flecken)** an der gegenüberliegenden Seite der Katze. Der Schlamm wächst in der Mitte so, dass er ein echtes Hindernis bildet und die Katze aktiv um den Schlamm herumnavigieren muss.

### 2. Chase (Diagonal-Fangen & Schwierigkeits-Feedback)
* **Nutzerbefund:** Beim Diagonallaufen springt die Katze am Schirm vorbei, selbst wenn man ihn visuell passiert. Zudem ist schwer erkennbar, wie der Schwierigkeitsgrad steigt.
* **Studienabgleich & Mechanik:** Das Gitter nutzt discrete Einzelschritte. Bei einem Diagonalschritt (`dx: 1, dy: 1`) springt die Katze von `(x, y)` direkt zu `(x+1, y+1)`. Steht der Schirm auf `(x+1, y)`, springt die Katze am Schirm vorbei.
* **Entscheidung (Testrunde 2):** 8-Wege-Steuerung bleibt erhalten (wichtig für flüssiges Diagonallaufen), aber die **Treffererkennung wird erweitert**: Ein Diagonalschritt prüft auch die überstrichenen/angrenzenden Zwischenfelder (`(x+dx, y)` und `(x, y+dy)`), sodass der Schirm verlässlich gefangen wird. Der Schwierigkeitsanstieg (kürzeres Zeitfenster & schnellere Schirm-Schritte) wird im HUD optisch verdeutlicht (z. B. Geschwindigkeits-Icon / Wind-Effekt).

### 3. Maze (Pfadbreite & Wandkontakt)
* **Nutzerbefund:** Der Weg ist 1 Feld breit; bei Wandkontakt vibriert der Screen und gibt Sound, der Trial läuft aber weiter. Ist das gewünscht?
* **Studienabgleich & Mechanik:** Ja, das weiche Abblocken (Shake + Sound ohne Trial-Abbruch/Reset) war die gezielte Korrektur aus Testrunde 1 (AP4), da Rueda (2005) die Maze-Übung als Antizipation/Pfadplanung beschreibt (nicht als Präzisionssteuerung mit Strafe). Allerdings ist 1 Feld Breite für 4-Jährige mit Arcade-Joystick oft hakelig.
* **Entscheidung (Testrunde 2):** Das straffreie Abblocken bleibt erhalten. Um das Abbiegen für 4-Jährige auf dem Joystick spürbar zu erleichtern, werden die Korridore in den frühen Stufen (Level 1–3) auf **2 Felder Breite** erweitert.

### 4. Anticipation (Ente sichtbar vs. unsichtbar)
* **Nutzerbefund:** Unklar, wie die Ente hilft. Ist die unsichtbare Variante logisch umgesetzt?
* **Studienabgleich:** Rueda (2005) beschreibt:
  * **Sichtbar:** Die Ente bewegt sich sichtbar auf ihre Zielspur zu; die Katze muss rechtzeitig dort stehen.
  * **Unsichtbar:** Die Ente zeigt kurz ihre Startspur/Flugrichtung, taucht unter Wasser und schwimmt verdeckt weiter. Die Katze muss antizipieren, in welcher Spur und wann sie unten auftaucht.
* **Problem im bisherigen Code:** In `anticipation-invisible` war die Ente während der gesamten Anflugphase komplett unsichtbar (0 % Information → 20 % Zufallsraten).
* **Entscheidung (Testrunde 2):** Die unsichtbare Ente zeigt sich zu Beginn für **800 ms** oben in der Zielspur, bevor sie untertaucht. Dadurch sieht das Kind die Zielspur, muss die Ankunftszeit antizipieren und die Katze rechtzeitig dorthin bewegen.

### 5. Number-Stroop (Zahlen vs. Äpfel)
* **Nutzerbefund:** Ist es bewusst mit Zahlen gemacht oder sollten es immer Äpfel sein?
* **Studienabgleich:** Die schrittweise Umstellung von Äpfeln auf Zahlen ist **100 % studienkonform**! Rueda (2005) definiert die *Number-Stroop*-Übung explizit so:
  * Frühe Level: Neutrale Objekte (z. B. Äpfel) – reiner Mengenvergleich.
  * Höhere Level: Arabische Ziffern (z. B. sieben „2"er vs. zwei „9"er) – Konflikt zwischen gedruckter Zahl und Objektanzahl.
* **Entscheidung (Testrunde 2):** Die Mechanik bleibt exakt so erhalten. Die Instruktion wird für 4-Jährige mit einer visuellen Grafik noch klarer herausgestellt ("Wähle die Seite mit MEHR Dingen!").

### 6. Spielstand-Persistenz (Laufende Speicherung)
* **Nutzerbefund:** Wird der Spielstand (welches Level pro Spiel ein Kind hat) laufend gespeichert?
* **Antwort:** **Ja!** Seit AP6 (Testrunde 1) wird jede Sitzung inkrementell in Cloud Firestore gespeichert:
  * Beim Start eines Trainingstages entsteht ein `trainingSessions`-Dokument mit `status: 'in-progress'`.
  * Nach jeder beendeten Übung wird die Ergebnisliste aktualisiert.
  * Nach jedem Level-Aufstieg wird ein `checkpoint` (Übungs-Index + Level + Streak) geschrieben.
  * Bei einem Neustart/Crash wird die Sitzung exakt am letzten Checkpoint fortgesetzt.

---

## 1. Arbeitspakete (Testrunde 2)

```
Reihenfolge: AP1 → AP2 → AP3 → AP4 → AP5 → AP6 → AP7
```

---

### AP1 — Side: Ziel-Grasfelder & Hindernis-Schlamm (keine 1-Schritt-Shortcuts)

**Ziel:** Die Wiese liegt nicht mehr an allen 4 Rändern. Die Katze muss den Schlamm aktiv umgehen, um das Ziel zu erreichen.

1. `src/training/exercises/side/maps.ts` überarbeiten:
   * Katze startet z. B. am unteren Rand (`y=8, x=4`).
   * Ziel-Grasflächen werden als **2×2 Gras-Flecken** am gegenüberliegenden (oberen) Rand platziert.
   * Schlammflecken wachsen in den Stufen 2–7 in der Mitte auf, sodass der direkte Weg blockiert wird und das Kind um den Schlamm herumsteuern muss.
2. `maps.test.ts` anpassen: Lösbarkeit (BFS-Pfad Start → Ziel-Grasflecken existiert), Schlamm-Wachstum und Hindernis-Platzierung automatisieren und absichern.

**Abnahme:** In keinem Level kann die Katze mit 1 Schritt die Wiese erreichen, ohne am Schlamm vorbeizusteuern. Map-Tests grün.

---

### AP2 — Chase: 8-Wege-Diagonal-Treffererkennung & Level-Visualisierung

**Ziel:** Diagonallaufen fängt den Schirm verlässlich; der Schwierigkeitsanstieg wird im HUD sichtbar.

1. In `src/training/exercises/chase/ChaseExercise.tsx`:
   * Bei einer Bewegung `({ dx, dy })` mit `dx !== 0 && dy !== 0` (Diagonalschritt):
     Prüfen, ob die Zielposition `next` **ODER** eines der angrenzenden Felder `(prev.x + dx, prev.y)` bzw. `(prev.x, prev.y + dy)` der Schirmposition entspricht.
   * Wenn ja: `endTrialRef.current(true)` auslösen.
2. Schwierigkeits-Feedback im HUD:
   * Bei höheren Leveln ein Geschwindigkeits-Icon (⚡ / 💨) neben dem Timer einblenden und die Schirm-Schrittanimation optisch anpassen.

**Abnahme:** Wenn der Schirm direkt diagonal neben der Katze steht, fängt ein Diagonalschritt den Schirm sofort. HUD zeigt Tempo-Steigerung an.

---

### AP3 — Maze: 2-Feld-breite Korridore in frühen Leveln (Level 1–3)

**Ziel:** 4-Jährige können mit dem Arcade-Joystick in den ersten Leveln flüssig abbiegen.

1. In `src/training/exercises/maze/maps.ts`:
   * Level 1–3 so überarbeiten, dass die Hauptwege mindestens **2 Felder breit** sind.
   * Level 4–6 dürfen für höhere Herausforderung 1–2 Felder breit bleiben.
2. Straffreies Abblocken (Wand stoppt Bewegung, Shake + Bump-Sound) beibehalten.
3. `maps.test.ts` für die neuen Pfadbreiten aktualisieren.

**Abnahme:** Auf Level 1–3 lässt sich die Katze mit dem Joystick ohne ständiges Wandstreifen durch das Labyrinth führen.

---

### AP4 — Anticipation (unsichtbar): 800 ms Einstiegs-Cue vor dem Untertauchen

**Ziel:** Die unsichtbare Ente bietet eine echte Antizipations-Aufgabe statt eines 20 %-Zufallsratens.

1. In `src/training/exercises/anticipation/AnticipationExercise.tsx`:
   * Auch bei `visible = false` wird die Ente zu Beginn des Trials für **800 ms** in ihrer Zielspur oben angezeigt (`phase === 'approaching' && elapsedMs < 800`).
   * Nach 800 ms taucht sie ab (Wellen-Symbol 🌊) und schwimmt verdeckt weiter.
   * Am Ende des Anflugs (`phase === 'catchable'`) taucht die Ente unten auf.
2. Komponententest in Vitest: Die Ente ist bei `visible = false` in den ersten 800 ms im DOM vorhanden und verschwindet danach bis zur Catch-Phase.

**Abnahme:** Das Kind sieht 800 ms lang, in welche Spur die Ente eintaucht, plant die Bewegung und bringt die Katze rechtzeitig dorthin.

---

### AP5 — Number-Stroop: Instruktion & visuelle Klarheit

**Ziel:** Bestätigung der Studien-Mechanik (Äpfel → Zahlen) und optimale Verständlichkeit für 4-Jährige.

1. `NumberStroopExercise.tsx`:
   * Die Umschaltung von Äpfeln (Level 1–2) auf Zahlen-Konflikte (Level 3–6) beibehalten (100 % studienkonform).
   * Die Instruktionsleiste unten optisch verstärken: *"Welche Seite hat MEHR Gegenstände?"* mit einem hervorgehobenen Mengen-Symbol.

**Abnahme:** Visuelle Instruktion ist für Vorschulkinder ohne Lesehilfe sofort verständlich.

---

### AP6 — Spielstand-Persistenz: Verifikation & Status-Anzeige im Dashboard

**Ziel:** Transparente Anzeige des gespeicherten Fortschritts pro Kind.

1. Verifizieren, dass `checkpoint` (Übung + Level) bei jedem Level-Aufstieg zuverlässig in Firestore geschrieben wird.
2. Im Betreuer-Dashboard ([ChildDashboard.tsx](file:///Users/raphscho/Documents/Projects/mindcat-focus-training/src/dashboard/ChildDashboard.tsx)) beim Trainingsverlauf anzeigen, welches Level in den einzelnen Übungen erreicht wurde.

**Abnahme:** Nach Abbrechen und Wiederkehren wird der exakte Level-Stand angezeigt und fortgesetzt.

---

### AP7 — Gesamte Verifikation (Testrunde 2)

1. `npm run typecheck`, `npm run lint` und `npm run test` ausführen — alle Tests grün.
2. Dev-Server-Durchlauf aller 8 Übungen + ANT mit Tastatur und Arcade-Joystick.
3. `npm run pilot` (E2E-Pilottest) erfolgreich durchführen.

---

*Erstellt für den Arbeitsablauf nach /grill-me. Bereit für die spätere schrittweise Umsetzung der Arbeitspakete AP1–AP7.*
