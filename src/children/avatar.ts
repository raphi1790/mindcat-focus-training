/**
 * Deterministische Avatar-Ableitung aus der childId (Tier + Farbe).
 *
 * Kindgerechte Auswahl-Karten brauchen ein wiedererkennbares Bild pro Kind,
 * ohne dass der Betreuer eines pflegen muss. Rein aus der (stabilen)
 * Dokument-ID abgeleitet → gleiches Kind zeigt immer denselben Avatar,
 * ohne zusätzlichen Firestore-Zustand.
 */

const ANIMALS = [
  '🐱',
  '🐶',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐸',
  '🐙',
  '🐰',
  '🦉',
  '🐷',
  '🐵',
  '🐺',
  '🦄',
] as const;

const COLORS = [
  '#f97316', // orange
  '#3b82f6', // blau
  '#22c55e', // grün
  '#a855f7', // violett
  '#ef4444', // rot
  '#06b6d4', // cyan
  '#eab308', // gelb
  '#ec4899', // pink
] as const;

export interface ChildAvatar {
  animal: string;
  color: string;
}

/** Einfacher, stabiler String-Hash (FNV-artig genug für Verteilungszwecke). */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(hash, 31) + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function deriveAvatar(childId: string): ChildAvatar {
  const hash = hashString(childId);
  const animal = ANIMALS[hash % ANIMALS.length] as string;
  const color = COLORS[Math.floor(hash / ANIMALS.length) % COLORS.length] as string;
  return { animal, color };
}
