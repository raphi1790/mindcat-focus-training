import { useEffect, useRef } from 'react';
import { soundManager } from './sound/soundManager';

/**
 * Leiser Cursor-Blip, wenn sich die Auswahl in einer Wahl-Übung bewegt
 * (Discrimination, Number). Beim Mount/Trial-Reset bleibt es still.
 */
export function useSelectionSound(selectedIndex: number, resetKey: unknown): void {
  const prevIndex = useRef(selectedIndex);
  const prevResetKey = useRef(resetKey);

  useEffect(() => {
    const isReset = resetKey !== prevResetKey.current;
    if (!isReset && selectedIndex !== prevIndex.current) {
      soundManager.play('select');
    }
    prevIndex.current = selectedIndex;
    prevResetKey.current = resetKey;
  }, [selectedIndex, resetKey]);
}
