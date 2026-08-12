import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAssessments, listChildren } from '../data/firestore';
import { computeEffectSummary } from './effectSummary';
import { computeGroupComparison, type GroupComparisonEntry } from './groupComparison';

export interface GroupComparisonData {
  loading: boolean;
  error: string | null;
  entries: GroupComparisonEntry[];
  /** Anzahl Kinder insgesamt, die überhaupt eine gültige Baseline+Post haben. */
  totalChildrenWithEffect: number;
  reload: () => Promise<void>;
}

/**
 * Lädt alle (nicht archivierten) Kinder eines Betreuers samt ihrer
 * Assessments und mittelt die Prä/Post-Δ je Studiengruppe (Plan §5.3 Punkt
 * 4 — nur relevant, wenn `studyGroup` gepflegt ist).
 */
export function useGroupComparisonData(uid: string): GroupComparisonData {
  const [entries, setEntries] = useState<GroupComparisonEntry[]>([]);
  const [totalChildrenWithEffect, setTotalChildrenWithEffect] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In einer eigenen useCallback-Funktion (statt direkt im Effekt-Körper),
  // damit die synchronen setState-Aufrufe vor dem Await nicht als
  // Cascading-Render-Anti-Pattern gewertet werden (s. `useChildren.ts`: die
  // im Effekt aufgerufene Funktion ist dieselbe Referenz, die auch nach
  // außen als `reload` zurückgegeben wird).
  const reload = useCallback(async () => {
    if (!uid) {
      setEntries([]);
      setTotalChildrenWithEffect(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const children = await listChildren(uid, { includeArchived: false });
      const perChild = await Promise.all(
        children.map(async (child) => {
          const assessments = await listAssessments(uid, child.id);
          const summary = computeEffectSummary(assessments);
          return { childId: child.id, studyGroup: child.studyGroup, summary };
        }),
      );
      const withEffect = perChild.filter(
        (p): p is typeof p & { summary: NonNullable<typeof p.summary> } => p.summary !== null,
      );
      setTotalChildrenWithEffect(withEffect.length);
      setEntries(computeGroupComparison(withEffect));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gruppenvergleich konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    // Datenabruf bei uid-Wechsel — sanktionierter Effect-Use-Case
    // ("Fetching data", React-Doku). `reload` setzt seinen State selbst;
    // s. `useChildren.ts` für dieselbe Begründung.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return useMemo(
    () => ({ loading, error, entries, totalChildrenWithEffect, reload }),
    [loading, error, entries, totalChildrenWithEffect, reload],
  );
}
