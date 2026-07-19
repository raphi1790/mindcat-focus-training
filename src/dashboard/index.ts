export { default as ChildDashboard } from './ChildDashboard';
export { computeEffectSummary } from './effectSummary';
export type { EffectMetric, EffectMetricKey, EffectSummary } from './effectSummary';
export { computeTrainingSummary } from './trainingSummary';
export type { DaySummary, ExerciseAggregate, TrainingSummary } from './trainingSummary';
export { buildRtHistogram } from './histogram';
export type { HistogramBin, RtHistogram } from './histogram';
export { computeGroupComparison } from './groupComparison';
export type { GroupComparisonEntry, GroupComparisonInput } from './groupComparison';
export {
  buildFullExportJson,
  downloadTextFile,
  scoresToCsv,
  sessionsToCsv,
  slugifyFilename,
  trialsToCsv,
} from './exportData';
