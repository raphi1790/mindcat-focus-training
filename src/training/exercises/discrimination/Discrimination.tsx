import DiscriminationExercise from './DiscriminationExercise';
import type { ExerciseProps } from '../../types';

export default function Discrimination(props: ExerciseProps) {
  return <DiscriminationExercise {...props} hasDelay={false} />;
}
