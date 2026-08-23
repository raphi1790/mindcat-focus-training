import { useCallback, useEffect, useState } from 'react';
import { createChild, listChildren, setChildArchived, updateChild } from '../data/firestore';
import type { Child, ChildInput } from '../data/schema';

/**
 * Kinder-Liste + CRUD für einen Betreuer (uid). Kapselt childrenRepo, damit
 * Komponenten nie direkt Firestore aufrufen (AGENTS.md-Regel).
 */
export interface UseChildrenResult {
  children: Child[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addChild: (input: ChildInput) => Promise<string>;
  editChild: (childId: string, input: Partial<ChildInput>) => Promise<void>;
  archiveChild: (childId: string) => Promise<void>;
  unarchiveChild: (childId: string) => Promise<void>;
}

export function useChildren(
  uid: string | null,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): UseChildrenResult {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) {
      setChildren([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listChildren(uid, { includeArchived });
      setChildren(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kinder konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [uid, includeArchived]);

  useEffect(() => {
    // Datenabruf bei Mount/uid-Wechsel — der in der React-Doku sanktionierte
    // "externes System synchronisieren"-Fall (Fetching data). `reload` setzt
    // seinen State selbst (loading/children/error); es gibt keine
    // Kaskaden-Renders im Sinn der Regel, da hier kein Render-Output von den
    // gesetzten Werten abhängt, bevor sie tatsächlich gebraucht werden.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const addChild = useCallback(
    async (input: ChildInput) => {
      if (!uid) throw new Error('Kein angemeldeter Betreuer.');
      const id = await createChild(uid, input);
      await reload();
      return id;
    },
    [uid, reload],
  );

  const editChild = useCallback(
    async (childId: string, input: Partial<ChildInput>) => {
      if (!uid) throw new Error('Kein angemeldeter Betreuer.');
      await updateChild(uid, childId, input);
      await reload();
    },
    [uid, reload],
  );

  const archiveChild = useCallback(
    async (childId: string) => {
      if (!uid) throw new Error('Kein angemeldeter Betreuer.');
      await setChildArchived(uid, childId, true);
      await reload();
    },
    [uid, reload],
  );

  const unarchiveChild = useCallback(
    async (childId: string) => {
      if (!uid) throw new Error('Kein angemeldeter Betreuer.');
      await setChildArchived(uid, childId, false);
      await reload();
    },
    [uid, reload],
  );

  return { children, loading, error, reload, addChild, editChild, archiveChild, unarchiveChild };
}
