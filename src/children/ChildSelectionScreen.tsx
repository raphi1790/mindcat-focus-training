import { useMemo, useState } from 'react';
import { useChildContext } from './ChildContext';
import { useChildrenProgress } from './useChildrenProgress';
import ChildAvatarCard from './ChildAvatarCard';
import { moveGridFocus } from './gridNav';
import { useConfirmInput, useDirectionalInput, type Direction } from '../platform/input';

/**
 * Kinder-Auswahl-Screen: ersetzt den Frei-Text-SessionStartScreen.
 * Kindgerecht (große Avatar-Karten), navigierbar mit Tastatur UND Arcade
 * ausschließlich über die platform/input-Abstraktion (Plan §4 Punkt 2).
 * Archivierte Kinder sind hier nie sichtbar.
 */

const COLUMNS = 3;

interface ChildSelectionScreenProps {
  uid: string;
  onChildConfirmed: (childId: string) => void;
  onManage: () => void;
  supervisorEmail?: string | null;
  onLogout?: () => void;
}

export default function ChildSelectionScreen({
  uid,
  onChildConfirmed,
  onManage,
  supervisorEmail,
  onLogout,
}: ChildSelectionScreenProps) {
  const { children, loading, error, activeChildId } = useChildContext();
  const visibleChildren = useMemo(() => children.filter((c) => !c.archived), [children]);
  const childIds = useMemo(() => visibleChildren.map((c) => c.id), [visibleChildren]);
  const { progress } = useChildrenProgress(uid, childIds);

  const [focusedIndex, setFocusedIndex] = useState(() => {
    const preselected = visibleChildren.findIndex((c) => c.id === activeChildId);
    return preselected >= 0 ? preselected : 0;
  });

  // Geklemmter Fokus-Index fürs Rendern/Navigieren — bewusst während des
  // Renders abgeleitet statt per Effekt nachgezogen (schrumpft z. B. die
  // Kinderliste durchs Archivieren, bleibt focusedIndex sonst außerhalb des
  // gültigen Bereichs hängen). Kein zusätzlicher Render-Zyklus nötig.
  const clampedFocusedIndex =
    visibleChildren.length === 0 ? 0 : Math.min(focusedIndex, visibleChildren.length - 1);

  const handleMove = (direction: Direction) => {
    setFocusedIndex(moveGridFocus(clampedFocusedIndex, direction, visibleChildren.length, COLUMNS));
  };

  const confirmFocused = () => {
    const child = visibleChildren[clampedFocusedIndex];
    if (child) onChildConfirmed(child.id);
  };

  useDirectionalInput(handleMove, { enabled: visibleChildren.length > 0 });
  useConfirmInput(confirmFocused, { enabled: visibleChildren.length > 0 });

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 to-blue-50 relative">
      <div className="absolute top-0 right-0 p-6 flex items-center gap-3 text-sm">
        {supervisorEmail && <span className="text-slate-400">{supervisorEmail}</span>}
        <button
          onClick={onManage}
          className="px-4 py-2 rounded-lg bg-white/80 border border-slate-200 text-slate-600 font-medium hover:bg-white"
        >
          Kinder verwalten
        </button>
        {onLogout && (
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-white/80 border border-slate-200 text-slate-600 font-medium hover:bg-white"
          >
            Abmelden
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen p-12">
        <h1 className="text-4xl font-extrabold text-slate-800 mb-2">Wer spielt heute mit? 🐾</h1>
        <p className="text-slate-500 font-medium mb-10">
          Mit den Pfeiltasten oder dem Joystick auswählen, mit Enter oder einem Arcade-Knopf bestätigen.
        </p>

        {loading && <p className="text-slate-500">Lade Kinder…</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && visibleChildren.length === 0 && (
          <div className="text-center bg-white/70 rounded-3xl p-10 border border-white">
            <p className="text-slate-600 font-medium mb-6">Noch keine Kinder angelegt.</p>
            <button
              onClick={onManage}
              className="px-6 py-3 rounded-2xl bg-purple-600 text-white font-bold hover:bg-purple-700"
            >
              Erstes Kind anlegen
            </button>
          </div>
        )}

        {visibleChildren.length > 0 && (
          <div className="grid grid-cols-3 gap-8 max-w-4xl">
            {visibleChildren.map((child, index) => (
              <ChildAvatarCard
                key={child.id}
                child={child}
                focused={index === clampedFocusedIndex}
                progress={progress[child.id]}
                onClick={() => {
                  setFocusedIndex(index);
                  onChildConfirmed(child.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
