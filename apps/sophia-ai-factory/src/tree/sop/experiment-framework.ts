export type {
  ExperimentVariant,
  SopExperiment,
  ExperimentEvaluation,
} from './experiment/types';
export {
  simpleHash,
  rowToExperiment,
  createExperiment,
  getActiveExperiments,
  assignVariant,
  recordOutcome,
  evaluateExperiment,
} from './experiment/index';
