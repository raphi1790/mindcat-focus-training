import type { AntConfig } from '../../data/schema';

/**
 * Kanonische Child-ANT-Konfiguration (Rueda et al. 2004, Neuropsychologia
 * 42:1029–1040; Plan §5.1). Wird mit jedem Assessment persistiert, damit
 * Läufe auch nach späteren Anpassungen vergleichbar bleiben.
 *
 * Trial-Ablauf: Fixation (variabel 400–1600 ms) → Cue (150 ms) →
 * Post-Cue-Fixation (450 ms) → Target (bis Antwort, max. 1700 ms) →
 * Post-Target-Intervall, sodass der Gesamt-Trial konstant ~4050 ms dauert
 * (d4 = total − verbrauchte Zeit). Worst Case 1600+150+450+1700 = 3900 ms
 * → d4 ≥ 150 ms, das Intervall wird nie negativ.
 */
export const ANT_TIMINGS = {
  fixationMinMs: 400,
  fixationMaxMs: 1600,
  cueMs: 150,
  postCueFixationMs: 450,
  targetMaxMs: 1700,
  /** Konstante Gesamt-Trial-Dauer im Testblock (kanonisch ~4050 ms). */
  totalTrialMs: 4050,
  /** Feedback-Dauer im Übungsblock (im Testblock gibt es kein Feedback). */
  practiceFeedbackMs: 1200,
} as const;

export const ANT_CONFIG: AntConfig = {
  practiceTrials: 24,
  testBlocks: 3,
  trialsPerBlock: 48,
  timings: ANT_TIMINGS,
};
