import { collection, doc, type Firestore } from 'firebase/firestore';

/**
 * Zentrale Pfad-Definitionen. Alle Daten liegen unter users/{uid}/** —
 * gespiegelt in firestore.rules (owner-only).
 */
export const childrenCollection = (db: Firestore, uid: string) =>
  collection(db, 'users', uid, 'children');

export const childDoc = (db: Firestore, uid: string, childId: string) =>
  doc(db, 'users', uid, 'children', childId);

export const assessmentsCollection = (db: Firestore, uid: string, childId: string) =>
  collection(db, 'users', uid, 'children', childId, 'assessments');

export const trainingSessionsCollection = (db: Firestore, uid: string, childId: string) =>
  collection(db, 'users', uid, 'children', childId, 'trainingSessions');
