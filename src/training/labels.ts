import type { ExerciseId } from '../data/schema';

/** Kindgerechte deutsche Anzeigenamen je Übung (Dashboard, Trainingsplan, Einzeltests). */
export const EXERCISE_LABELS: Record<ExerciseId, string> = {
  side: 'Side (Motorische Kontrolle)',
  chase: 'Chase (Verfolgung)',
  maze: 'Maze (Antizipation/Planung)',
  'anticipation-visible': 'Anticipation – sichtbar',
  'anticipation-invisible': 'Anticipation – unsichtbar',
  discrimination: 'Discrimination',
  'discrimination-delay': 'Discrimination – Delay',
  number: 'Number',
  'number-stroop': 'Number-Stroop',
  farmer: 'Farmer (Go/No-Go)',
};

/** Icons für die Einzeltests-Übersicht (rein kosmetisch). */
export const EXERCISE_ICONS: Record<ExerciseId, string> = {
  side: '🐱',
  chase: '🌂',
  maze: '🧩',
  'anticipation-visible': '🦆',
  'anticipation-invisible': '🌊',
  discrimination: '🐾',
  'discrimination-delay': '🧠',
  number: '🔢',
  'number-stroop': '🍎',
  farmer: '🐑',
};
