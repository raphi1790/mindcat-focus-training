import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

/**
 * Firestore liefert Timestamps; die Domäne arbeitet mit Date.
 * (serverTimestamp()-Sentinels tauchen nur beim Schreiben auf und laufen
 * nicht durch Lese-Schemas.)
 */
export const dateFromTimestamp = z.preprocess(
  (value) => (value instanceof Timestamp ? value.toDate() : value),
  z.date(),
);

/** Studien-Kohorten: 4- und 6-Jährige (Rueda 2005). */
export const ageGroupSchema = z.union([z.literal(4), z.literal(6)]);
export type AgeGroup = z.infer<typeof ageGroupSchema>;
