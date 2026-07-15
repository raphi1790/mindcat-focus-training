export {
  DEFAULT_DEADZONE,
  choiceFromGamepad,
  connectedGamepads,
  directionFromGamepad,
} from './gamepad';
export type { Axis, Choice, Direction, GamepadLike } from './gamepad';
export { useDirectionalInput } from './useDirectionalInput';
export type { DirectionalInputOptions } from './useDirectionalInput';
export { useChoiceInput } from './useChoiceInput';
export type { ChoiceEvent, ChoiceInputOptions } from './useChoiceInput';
