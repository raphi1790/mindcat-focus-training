import { useEffect, useMemo, useState } from 'react';
import { getChildProgress } from '../data/firestore';
import type { ChildProgress } from '../data/progress';

/** Fortschritt je Kind (Baseline/Trainingstag/Post) für eine Liste von IDs laden. */
export function useChildrenProgress(
  uid: string | null,
  childIds: readonly string[],
): { progress: Record<string, ChildProgress>; loading: boolean } {
  const [progress, setProgress] = useState<Record<string, ChildProgress>>({});
  const [loading, setLoading] = useState(false);
  // Stabiler Dependency-Key statt der Array-Referenz (die sich bei jedem
  // Render neu bilden kann, auch wenn der Inhalt gleich bleibt).
  const idsKey = useMemo(() => childIds.join(','), [childIds]);

  useEffect(() => {
    const ids = idsKey.length > 0 ? idsKey.split(',') : [];
    let cancelled = false;

    // Datenabruf bei uid-/IDs-Wechsel — sanktionierter Effect-Use-Case
    // ("Fetching data", React-Doku). Die synchronen setState-Aufrufe direkt
    // im Effekt-Körper setzen Lade-/Leerzustand, bevor der eigentliche Abruf
    // (im .then()-Callback, s. u.) das Ergebnis liefert.
    if (!uid || ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress({});
      return;
    }

    setLoading(true);
    Promise.all(ids.map(async (id) => [id, await getChildProgress(uid, id)] as const))
      .then((entries) => {
        if (cancelled) return;
        setProgress(Object.fromEntries(entries));
      })
      .catch(() => {
        // Fortschritt ist eine Zusatzinfo im Auswahl-Screen — ein Fehler
        // beim Laden darf die Kinder-Auswahl selbst nicht blockieren.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, idsKey]);

  return { progress, loading };
}
