import { addDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  assessmentDocSchema,
  assessmentInputSchema,
  type Assessment,
  type AssessmentInput,
} from '../schema';
import { assessmentsCollection } from './paths';

/**
 * ANT-Läufe (Baseline/Post/Interim). Append-only: Die Security Rules
 * verbieten Update/Delete — Messdaten werden nie nachträglich verändert.
 */

export async function addAssessment(
  uid: string,
  childId: string,
  input: AssessmentInput,
): Promise<string> {
  const payload = assessmentInputSchema.parse(input);
  const ref = await addDoc(assessmentsCollection(db, uid, childId), {
    ...payload,
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

export async function listAssessments(uid: string, childId: string): Promise<Assessment[]> {
  const snapshot = await getDocs(
    query(assessmentsCollection(db, uid, childId), orderBy('timestamp', 'asc')),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...assessmentDocSchema.parse(d.data()) }));
}
