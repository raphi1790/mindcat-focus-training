/**
 * Side-Übung: Katze über ein offenes Feld zum Gras bewegen, Schlamm meiden.
 * 0 = Pfad (sicher), 1 = Schlamm (Gefahr), 2 = Gras (Ziel), 3 = Start.
 * 7 Level (Plan §6.2: a=7, b=21, c=3).
 *
 * AP5/Befund B: kein Labyrinth (Korridor mit einem Weg) — die Studie
 * beschreibt Gras an allen vier Rändern, das mit steigendem Level schrumpft,
 * während wachsende Schlammflecken die Mitte einnehmen. Es gibt auf jedem
 * Level immer mehrere freie Wege zum Gras; der äußerste Feldrand (Zeile/
 * Spalte 0 und GRID_SIZE-1) bleibt ab Level 2 bewusst schlammfrei, damit eine
 * geschlossene Rundstrecke um den Schlammfleck erhalten bleibt (zwei
 * disjunkte Wege zwischen Start und Ziel, unabhängig davon, wie groß der
 * Schlammfleck wird). Generiert und auf genau diese Eigenschaften geprüft
 * (Lösbarkeit, ≥ 2 disjunkte Pfade, streng monotones Schlamm-Wachstum/
 * Gras-Schrumpfen, Freiraum-Quoten) — siehe maps.test.ts.
 */
export const GRID_SIZE = 10;

export const LEVEL_MAPS: Record<number, number[][]> = {
  1: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 0, 0, 0, 0, 0, 0, 2, 2],
    [2, 2, 0, 0, 0, 0, 0, 0, 2, 2],
    [2, 2, 0, 0, 3, 0, 0, 0, 2, 2],
    [2, 2, 0, 0, 0, 0, 0, 0, 2, 2],
    [2, 2, 0, 0, 0, 0, 0, 0, 2, 2],
    [2, 2, 0, 0, 0, 0, 0, 0, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
  2: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 1, 1, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 1, 1, 0, 0, 0, 2],
    [2, 0, 0, 1, 1, 3, 0, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
  3: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [2, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [2, 0, 0, 1, 1, 1, 1, 3, 0, 0],
    [2, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [2, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
  4: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [3, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
  5: [
    [0, 0, 0, 2, 2, 2, 2, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [3, 0, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 2, 2, 2, 2, 0, 0, 0],
  ],
  6: [
    [0, 0, 0, 0, 2, 2, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  7: [
    [0, 0, 0, 0, 2, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 3, 0, 0, 0, 0, 0, 0],
  ],
};

export function getStartPosition(level: number): { x: number; y: number } {
  const map = LEVEL_MAPS[level];
  if (map) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (map[y]?.[x] === 3) return { x, y };
      }
    }
  }
  return { x: 4, y: 4 };
}
