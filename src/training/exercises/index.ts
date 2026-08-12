import type { ComponentType } from 'react';
import type { ExerciseId } from '../../data/schema';
import type { ExerciseProps } from '../types';
import SideExercise from './side/SideExercise';
import ChaseExercise from './chase/ChaseExercise';
import MazeExercise from './maze/MazeExercise';
import AnticipationVisible from './anticipation/AnticipationVisible';
import AnticipationInvisible from './anticipation/AnticipationInvisible';
import Discrimination from './discrimination/Discrimination';
import DiscriminationDelay from './discrimination/DiscriminationDelay';
import NumberExercise from './number/NumberExercise';
import NumberStroopExercise from './numberStroop/NumberStroopExercise';
import FarmerExercise from './farmer/FarmerExercise';

/** Zentrale Zuordnung ExerciseId → Übungs-Komponente (Plan §9 Phase 4). */
export const EXERCISE_COMPONENTS: Record<ExerciseId, ComponentType<ExerciseProps>> = {
  side: SideExercise,
  chase: ChaseExercise,
  maze: MazeExercise,
  'anticipation-visible': AnticipationVisible,
  'anticipation-invisible': AnticipationInvisible,
  discrimination: Discrimination,
  'discrimination-delay': DiscriminationDelay,
  number: NumberExercise,
  'number-stroop': NumberStroopExercise,
  farmer: FarmerExercise,
};
