import { computeChildProgress, type ChildProgress } from '../progress';
import { listAssessments } from './assessmentsRepo';
import { listTrainingSessions } from './trainingSessionsRepo';

/** Fortschritt eines Kindes aus seinen Subcollections berechnen. */
export async function getChildProgress(uid: string, childId: string): Promise<ChildProgress> {
  const [assessments, sessions] = await Promise.all([
    listAssessments(uid, childId),
    listTrainingSessions(uid, childId),
  ]);
  return computeChildProgress(assessments, sessions);
}
