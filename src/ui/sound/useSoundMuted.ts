import { useSyncExternalStore } from 'react';
import { soundManager } from './soundManager';

/** Reaktiver Mute-Zustand der Sound-Engine (für den SoundToggle). */
export function useSoundMuted(): boolean {
  return useSyncExternalStore(soundManager.subscribe, soundManager.getSnapshot, () => true);
}
