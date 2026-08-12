import { z } from 'zod';
import { ageGroupSchema, dateFromTimestamp } from './common';

/**
 * Kind-Profil unter users/{uid}/children/{childId}.
 * Datenschutz: displayName ist ein Pseudonym/Anzeigename — Klarnamen sind
 * nicht erforderlich.
 */

/** Für Gruppenvergleiche im Dashboard (trainiert vs. Kontrolle). */
export const studyGroupSchema = z.enum(['trained', 'control']);
export type StudyGroup = z.infer<typeof studyGroupSchema>;

/** Vom Betreuer editierbare Felder (Create/Update-Payload). */
export const childInputSchema = z.object({
  displayName: z.string().trim().min(1, 'Anzeigename fehlt').max(60),
  ageGroup: ageGroupSchema,
  /** Optional 'YYYY-MM' für exakte Altersberechnung. */
  birthMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format YYYY-MM')
    .optional(),
  sex: z.enum(['m', 'f', 'x']).optional(),
  studyGroup: studyGroupSchema.optional(),
});
export type ChildInput = z.infer<typeof childInputSchema>;

/** Persistiertes Dokument (Lese-Schema). */
export const childDocSchema = childInputSchema.extend({
  createdAt: dateFromTimestamp,
  archived: z.boolean(),
});
export type ChildDoc = z.infer<typeof childDocSchema>;

/** Domänenobjekt inkl. Dokument-ID. */
export type Child = ChildDoc & { id: string };
