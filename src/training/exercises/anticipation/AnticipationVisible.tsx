import AnticipationExercise from './AnticipationExercise';
import type { ExerciseProps } from '../../types';

export default function AnticipationVisible(props: ExerciseProps) {
  return <AnticipationExercise {...props} visible />;
}
