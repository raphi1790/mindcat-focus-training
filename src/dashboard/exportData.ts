import type { Assessment, Child, TrainingSession } from '../data/schema';

/**
 * Datenexport (Plan §5.3 Punkt 5): Roh-Trials + Scores als CSV/JSON, damit
 * externe statistische Auswertung möglich ist. Die Builder-Funktionen sind
 * rein (testbar); nur `downloadTextFile` fasst den Browser-Download an.
 */

type CsvCell = string | number | boolean | null;

function csvEscape(value: CsvCell): string {
  const s = value === null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: readonly string[], rows: readonly CsvCell[][]): string {
  const lines = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))];
  return lines.join('\n');
}

/** Ein Roh-Trial pro Zeile, mit Assessment-Kontext (Phase/Zeitstempel/Seed). */
export function trialsToCsv(assessments: readonly Assessment[]): string {
  const headers = [
    'assessmentId',
    'phase',
    'timestamp',
    'rngSeed',
    'trialIndex',
    'block',
    'cue',
    'flanker',
    'position',
    'targetDir',
    'responseDir',
    'correct',
    'rt',
    'onsetTs',
    'fixationMs',
  ] as const;

  const rows: CsvCell[][] = assessments.flatMap((a) =>
    a.rawTrials.map((t) => [
      a.id,
      a.phase,
      a.timestamp.toISOString(),
      a.rngSeed,
      t.index,
      t.block,
      t.cue,
      t.flanker,
      t.position,
      t.targetDir,
      t.responseDir,
      t.correct,
      t.rt,
      t.onsetTs,
      t.fixationMs,
    ]),
  );

  return rowsToCsv(headers, rows);
}

/** Ein Assessment pro Zeile: Scores + Qualitätsflag. */
export function scoresToCsv(assessments: readonly Assessment[]): string {
  const headers = [
    'assessmentId',
    'phase',
    'timestamp',
    'ageGroupAtTest',
    'overallRT',
    'conflictRT',
    'alertingRT',
    'orientingRT',
    'overallErrorRate',
    'excluded',
    'exclusionReason',
    'validTrialCount',
    'totalTrials',
  ] as const;

  const rows: CsvCell[][] = assessments.map((a) => [
    a.id,
    a.phase,
    a.timestamp.toISOString(),
    a.ageGroupAtTest,
    a.scores.overallRT,
    a.scores.conflictRT,
    a.scores.alertingRT,
    a.scores.orientingRT,
    a.scores.overallErrorRate,
    a.quality.excluded,
    a.quality.reason ?? null,
    a.quality.validTrialCount,
    a.rawTrials.length,
  ]);

  return rowsToCsv(headers, rows);
}

/**
 * Ein Übungsergebnis pro Zeile, mit Sitzungs-Kontext (Tag/Zeitstempel).
 * Laufende (in-progress) Sitzungen werden ausgeblendet (AP6) — sie sind noch
 * kein Datenpunkt und erscheinen vollständig, sobald der Tag abgeschlossen ist.
 */
export function sessionsToCsv(sessions: readonly TrainingSession[]): string {
  const headers = [
    'sessionId',
    'sessionDay',
    'timestamp',
    'exerciseId',
    'levelsCompleted',
    'highestLevel',
    'trials',
    'correct',
    'errors',
    'missed',
    'trialToAdvanceRate',
    'durationMs',
  ] as const;

  const rows: CsvCell[][] = sessions
    .filter((s) => s.status !== 'in-progress')
    .flatMap((s) =>
    s.exercises.map((e) => [
      s.id,
      s.sessionDay,
      s.timestamp.toISOString(),
      e.exerciseId,
      e.levelsCompleted,
      e.highestLevel,
      e.trials,
      e.correct,
      e.errors,
      e.missed,
      e.trialToAdvanceRate,
      e.durationMs,
    ]),
  );

  return rowsToCsv(headers, rows);
}

/** Vollständiger Rohdaten-Export als JSON-serialisierbares Objekt (Zeitstempel als ISO-Strings). */
export function buildFullExportJson(
  child: Pick<Child, 'displayName' | 'ageGroup' | 'studyGroup'>,
  assessments: readonly Assessment[],
  sessions: readonly TrainingSession[],
): unknown {
  return {
    exportedAt: new Date().toISOString(),
    child: {
      displayName: child.displayName,
      ageGroup: child.ageGroup,
      studyGroup: child.studyGroup ?? null,
    },
    assessments: assessments.map((a) => ({ ...a, timestamp: a.timestamp.toISOString() })),
    // Laufende (in-progress) Sitzungen bleiben aus dem Export (AP6); sie
    // erscheinen vollständig, sobald der Tag als `completed` gespeichert ist.
    trainingSessions: sessions
      .filter((s) => s.status !== 'in-progress')
      .map((s) => ({ ...s, timestamp: s.timestamp.toISOString() })),
  };
}

/** Löst einen Browser-Download aus (Blob + temporärer Anchor-Klick). */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Dateiname-sicherer Slug aus dem Anzeigenamen (kein Datenschutzrisiko: Pseudonym erlaubt). */
export function slugifyFilename(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'kind'
  );
}
