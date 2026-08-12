import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useChildren, type UseChildrenResult } from './useChildren';
import type { Child } from '../data/schema';

/**
 * Skopierung: Nach Auswahl ist ein childId aktiv; alle Reads/Writes laufen
 * unter users/{uid}/children/{childId}/... (Plan §4 Punkt 3).
 *
 * Hält zusätzlich die Kinder-Liste eines Betreuers (eine Quelle der
 * Wahrheit für Auswahl-Screen und Verwaltung), inkl. optionalem
 * "Archivierte einblenden"-Modus für die Verwaltung.
 */
interface ChildContextValue extends UseChildrenResult {
  activeChildId: string | null;
  activeChild: Child | null;
  selectChild: (childId: string | null) => void;
  includeArchived: boolean;
  setIncludeArchived: (value: boolean) => void;
}

const ChildContext = createContext<ChildContextValue | null>(null);

export function ChildProvider({
  uid,
  children: reactChildren,
}: {
  uid: string | null;
  children: ReactNode;
}) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const childrenState = useChildren(uid, { includeArchived });
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const activeChild = useMemo(
    () => childrenState.children.find((c) => c.id === activeChildId) ?? null,
    [childrenState.children, activeChildId],
  );

  const value: ChildContextValue = {
    ...childrenState,
    activeChildId,
    activeChild,
    selectChild: setActiveChildId,
    includeArchived,
    setIncludeArchived,
  };

  return <ChildContext.Provider value={value}>{reactChildren}</ChildContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChildContext(): ChildContextValue {
  const ctx = useContext(ChildContext);
  if (!ctx) {
    throw new Error('useChildContext muss innerhalb von <ChildProvider> verwendet werden.');
  }
  return ctx;
}
