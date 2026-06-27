/**
 * H10 — Experiment engine barrel.
 */
export { assignVariant } from "./bucketing.js";
export {
  normalCdf,
  twoProportionZTest,
  wilsonInterval,
  minSampleSizePerArm,
  type ZTestResult,
  type WilsonInterval,
} from "./stats.js";
export {
  EXPERIMENTS,
  getExperiment,
  type ExperimentDefinition,
} from "./registry.js";
export {
  computeExperimentResult,
  type PerVariantStats,
  type ExperimentResult,
} from "./lift.js";
