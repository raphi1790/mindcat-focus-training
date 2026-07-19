import {
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  childDocSchema,
  childInputSchema,
  type Child,
  type ChildInput,
} from '../schema';
import { childDoc, childrenCollection } from './paths';
import { stripUndefinedDeep } from './serialize';

/**
 * Kinder-Verwaltung (Teil 2 des Plans).
 * Jedes Dokument wird an der Firestore-Grenze zod-validiert; ein defektes
 * Dokument wirft statt stillschweigend falsche Daten zu liefern.
 */

export async function createChild(uid: string, input: ChildInput): Promise<string> {
  const payload = stripUndefinedDeep(childInputSchema.parse(input));
  const ref = await addDoc(childrenCollection(db, uid), {
    ...payload,
    createdAt: serverTimestamp(),
    archived: false,
  });
  return ref.id;
}

export async function listChildren(
  uid: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Child[]> {
  const snapshot = await getDocs(query(childrenCollection(db, uid), orderBy('createdAt', 'asc')));
  const children = snapshot.docs.map((d) => ({ id: d.id, ...childDocSchema.parse(d.data()) }));
  return includeArchived ? children : children.filter((c) => !c.archived);
}

export async function updateChild(
  uid: string,
  childId: string,
  input: Partial<ChildInput>,
): Promise<void> {
  const payload = stripUndefinedDeep(childInputSchema.partial().parse(input));
  await updateDoc(childDoc(db, uid, childId), payload);
}

export async function setChildArchived(
  uid: string,
  childId: string,
  archived: boolean,
): Promise<void> {
  await updateDoc(childDoc(db, uid, childId), { archived });
}
