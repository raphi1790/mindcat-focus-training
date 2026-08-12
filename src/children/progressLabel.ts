import type { ChildProgress } from '../data/progress';

/** Kindgerecht-neutrale Kurzbeschreibung des Fortschritts für die Auswahl-Karte. */
export function progressLabel(progress: ChildProgress): string {
  switch (progress.nextStep) {
    case 'baseline':
      return 'Einstufungstest steht an';
    case 'training':
      return `Trainingstag ${progress.nextSessionDay} von 5`;
    case 'post':
      return 'Abschlusstest steht an';
    case 'done':
      return 'Programm abgeschlossen';
  }
}
