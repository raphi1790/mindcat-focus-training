/**
 * Synthesizer-Sound-Engine für das Training (Plan §6.3): kurze Chiptune-artige
 * Effekte direkt über WebAudio — keine Audio-Assets, kein Netzwerk. Mit
 * persistierter Mute-Option.
 *
 * Wissenschaftliche Grenze: Diese Engine darf ausschließlich von Trainings-
 * Komponenten importiert werden. Der ANT (assessment/) bleibt komplett
 * stumm — kein Ton darf Reaktionszeiten im Test beeinflussen.
 */

export type SoundName =
  | 'step' //     leiser Bewegungs-Tick (Gitter-Übungen)
  | 'select' //   Cursor-Blip bei Auswahl-Übungen
  | 'success' //  richtige Antwort
  | 'error' //    falsche Antwort / Schlamm
  | 'levelUp' //  Level-Aufstieg (kleine Fanfare)
  | 'star' //     Stern eingesammelt (Belohnungsschirm)
  | 'fanfare' //  Übung/Tag geschafft (große Fanfare)
  | 'bump'; //    Wandkontakt (Maze) — kein Fehler, nur Kollisions-Feedback

interface Note {
  /** Startzeit relativ zum Abspielbeginn in Sekunden. */
  at: number;
  freq: number;
  /** Dauer in Sekunden. */
  dur: number;
  type: OscillatorType;
  gain: number;
}

// Frequenzen: C5=523.25, E5=659.25, G5=784, C6=1046.5, E6=1318.5, G6=1568.
const SOUNDS: Record<SoundName, Note[]> = {
  step: [{ at: 0, freq: 520, dur: 0.05, type: 'triangle', gain: 0.05 }],
  select: [{ at: 0, freq: 660, dur: 0.06, type: 'square', gain: 0.04 }],
  success: [
    { at: 0, freq: 523.25, dur: 0.12, type: 'triangle', gain: 0.16 },
    { at: 0.1, freq: 659.25, dur: 0.2, type: 'triangle', gain: 0.16 },
  ],
  error: [
    { at: 0, freq: 220, dur: 0.15, type: 'sawtooth', gain: 0.1 },
    { at: 0.13, freq: 174.6, dur: 0.22, type: 'sawtooth', gain: 0.08 },
  ],
  levelUp: [
    { at: 0, freq: 523.25, dur: 0.11, type: 'triangle', gain: 0.16 },
    { at: 0.1, freq: 659.25, dur: 0.11, type: 'triangle', gain: 0.16 },
    { at: 0.2, freq: 784, dur: 0.11, type: 'triangle', gain: 0.16 },
    { at: 0.3, freq: 1046.5, dur: 0.3, type: 'triangle', gain: 0.18 },
  ],
  star: [
    { at: 0, freq: 1046.5, dur: 0.09, type: 'sine', gain: 0.14 },
    { at: 0.07, freq: 1568, dur: 0.18, type: 'sine', gain: 0.12 },
  ],
  fanfare: [
    { at: 0, freq: 523.25, dur: 0.14, type: 'triangle', gain: 0.16 },
    { at: 0.14, freq: 523.25, dur: 0.1, type: 'triangle', gain: 0.14 },
    { at: 0.26, freq: 659.25, dur: 0.14, type: 'triangle', gain: 0.16 },
    { at: 0.42, freq: 784, dur: 0.16, type: 'triangle', gain: 0.16 },
    { at: 0.6, freq: 1046.5, dur: 0.42, type: 'triangle', gain: 0.2 },
    { at: 0.6, freq: 659.25, dur: 0.42, type: 'sine', gain: 0.08 },
  ],
  bump: [{ at: 0, freq: 160, dur: 0.07, type: 'sine', gain: 0.07 }],
};

const STORAGE_KEY = 'mindcat.sound-muted';

function readPersistedMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = readPersistedMuted();
  private listeners = new Set<() => void>();

  /**
   * AudioContext lazy erzeugen — Browser erlauben Audio erst nach einer
   * User-Geste; Übungen starten immer per Klick/Tastendruck, daher greift
   * das spätestens beim ersten Feedback-Sound.
   */
  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  play(name: SoundName): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    for (const note of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, t0 + note.at);
      // Kurzer Attack gegen Klicken, danach exponentieller Ausklang.
      gain.gain.setValueAtTime(0, t0 + note.at);
      gain.gain.linearRampToValueAtTime(note.gain, t0 + note.at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + note.at);
      osc.stop(t0 + note.at + note.dur + 0.05);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // Persistenz ist optional (z. B. Private Mode) — Mute wirkt trotzdem.
    }
    this.listeners.forEach((listener) => listener());
  }

  /** Für useSyncExternalStore: benachrichtigt bei Mute-Änderungen. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): boolean => this.muted;
}

export const soundManager = new SoundManager();
