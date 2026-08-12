import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAssessments, listTrainingSessions } from '../data/firestore';
import type { Assessment, TrainingSession } from '../data/schema';
import { computeEffectSummary, type EffectSummary } from './effectSummary';
import { buildRtHistogram, type RtHistogram } from './histogram';
import { computeTrainingSummary, type TrainingSummary } from './trainingSummary';

export interface ChildDashboardData {
  loading: boolean;
  error: string | null;
  assessments: Assessment[];
  sessions: TrainingSession[];
  effectSummary: EffectSummary | null;
  trainingSummary: TrainingSummary;
  histogram: RtHistogram | null;
  /** Das Assessment, dessen rawTrials das Histogramm speist (das jüngste). */
  histogramSource: Assessment | null;
  reload: () => Promise<void>;
}

/**
 * Lädt Assessments + Trainingssitzungen eines Kindes und leitet die
 * Dashboard-Auswertungen (Plan §5.3) daraus ab. Analog zu
 * `useChildrenProgress`: Datenabruf im Effekt, Ableitungen per useMemo.
 */
export function useChildDashboardData(uid: string, childId: string): ChildDashboardData {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In einer eigenen useCallback-Funktion (statt direkt im Effekt-Körper),
  // damit die synchronen setState-Aufrufe vor dem Await nicht als
  // Cascading-Render-Anti-Pattern gewertet werden (s. `useChildren.ts`: die
  // im Effekt aufgerufene Funktion ist dieselbe Referenz, die auch nach
  // außen als `reload` zurückgegeben wird).
  const reload = useCallback(async () => {
    if (!uid || !childId) {
      setAssessments([]);
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [a, s] = await Promise.all([listAssessments(uid, childId), listTrainingSessions(uid, childId)]);
      setAssessments(a);
      setSessions(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [uid, childId]);

  useEffect(() => {
    // Datenabruf bei Kind-/uid-Wechsel — sanktionierter Effect-Use-Case
    // ("Fetching data", React-Doku). `reload` setzt seinen State selbst;
    // s. `useChildren.ts` für dieselbe Begründung.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const effectSummary = useMemo(() => computeEffectSummary(assessments), [assessments]);
  const trainingSummary = useMemo(() => computeTrainingSummary(sessions), [sessions]);
  // Jüngstes Assessment unabhängig von Phase/Exclusion — zeigt die aktuellste
  // RT-Verteilung zu Transparenzzwecken (Plan §5.3 Punkt 3).
  const histogramSource = assessments.length > 0 ? (assessments[assessments.length - 1] ?? null) : null;
  const histogram = useMemo(
    () => (histogramSource ? buildRtHistogram(histogramSource.rawTrials) : null),
    [histogramSource],
  );

  return {
    loading,
    error,
    assessments,
    sessions,
    effectSummary,
    trainingSummary,
    histogram,
    histogramSource,
    reload,
  };
}
