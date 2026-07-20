import AnticipationExercise from './AnticipationExercise';
import type { ExerciseProps } from '../../types';

export default function AnticipationInvisible(props: ExerciseProps) {
  return <AnticipationExercise {...props} visible={false} />;
}
