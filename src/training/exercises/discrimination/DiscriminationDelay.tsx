import DiscriminationExercise from './DiscriminationExercise';
import type { ExerciseProps } from '../../types';

export default function DiscriminationDelay(props: ExerciseProps) {
  return <DiscriminationExercise {...props} hasDelay />;
}
