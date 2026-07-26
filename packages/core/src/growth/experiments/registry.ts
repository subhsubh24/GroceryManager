/**
 * H10 — Code-defined experiment registry.
 *
 * Experiments are defined here (no admin DB step). Each entry describes the hypothesis,
 * variants, the primary conversion event, and the minimum sample size per arm to declare a
 * winner. The data lives in code so it's versioned alongside the feature and never drifts
 * from what the bucketing/stats layer actually tests.
 */
import { minSampleSizePerArm } from "./stats.js";

export interface ExperimentDefinition {
  /** Stable identifier — matches `experiment_id` in DB tables. */
  id: string;
  /** Falsifiable hypothesis. */
  hypothesis: string;
  /** Ordered variant names. The first is always the control. */
  variants: string[];
  /** Primary Plausible/custom event that counts as a conversion. */
  primaryEvent: string;
  /**
   * Minimum exposures per arm required before we can declare a winner.
   * Below this → status "running", lift null, never fabricated.
   */
  minSamplePerArm: number;
}

/**
 * The deployed experiment registry. Add new experiments here; each is DORMANT (no traffic
 * assigned) until the owner connects a live channel or signs-in users start landing on pages
 * that call `assignAndLogVariant`.
 */
export const EXPERIMENTS: ExperimentDefinition[] = [
  {
    id: "landing_hero",
    hypothesis:
      "Variant B ('Stop guessing at dinner') and C ('Your kitchen, finally in sync') increase " +
      "waitlist signup rate vs the current variant A ('Always know what to cook') by at least 2pp.",
    variants: ["a", "b", "c"],
    primaryEvent: "waitlist_signup",
    // 5% baseline, +2pp MDE, α=0.05, power=0.80 → ~1192 per arm; floor at 100 for early signal.
    minSamplePerArm: Math.max(100, minSampleSizePerArm(0.05, 0.02)),
  },
  {
    id: "h14_annual_nudge",
    hypothesis:
      "For active monthly subscribers at month 3, leading the nudge with the dollar saving " +
      "('savings') converts more monthly→annual switches than the routine framing ('control').",
    variants: ["control", "savings"],
    primaryEvent: "annual_switch",
    // 8% baseline switch rate, +3pp MDE — exposures logged on send; conversion stays "running" /
    // null until switches are logged (never fabricated). Floor at 100 for early signal.
    minSamplePerArm: Math.max(100, minSampleSizePerArm(0.08, 0.03)),
  },
  {
    id: "h15_winback",
    hypothesis:
      "For churned-but-active free users, leading win-back with what Premium adds ('value') " +
      "reactivates more than the warm welcome framing ('control').",
    variants: ["control", "value"],
    primaryEvent: "reactivate",
    // 5% baseline reactivation, +2pp MDE; conversion stays "running" / null until reactivations are
    // logged (never fabricated). Floor at 100 for early signal.
    minSamplePerArm: Math.max(100, minSampleSizePerArm(0.05, 0.02)),
  },
  {
    id: "h16_trial_welcome",
    hypothesis:
      "A transparent day-0 trial welcome that lists what Premium unlocks and nudges the best first " +
      "step (connect Gmail) lifts trial→paid conversion vs sending nothing. Single arm — kept in the " +
      "registry for exposure consistency with the rest of the trial (T1–T3) sequence.",
    variants: ["control"],
    primaryEvent: "trial_convert",
    // 40% baseline trial→paid, +5pp MDE; conversion stays "running" / null until real conversions are
    // logged (never fabricated). Floor at 100 for early signal.
    minSamplePerArm: Math.max(100, minSampleSizePerArm(0.4, 0.05)),
  },
  {
    id: "h17_trial_reminder",
    hypothesis:
      "For trials with ~2 days left, leading the reminder with the time/countdown framing ('urgency') " +
      "holds more trials through to paid conversion than the value framing ('control'). Both are honest " +
      "about the auto-convert — the sub begins at $4.99/mo unless cancelled.",
    variants: ["control", "urgency"],
    primaryEvent: "trial_convert",
    // 40% baseline trial→paid, +5pp MDE; conversion stays "running" / null until real conversions are
    // logged (never fabricated). Floor at 100 for early signal.
    minSamplePerArm: Math.max(100, minSampleSizePerArm(0.4, 0.05)),
  },
  {
    id: "h18_trial_expiry",
    hypothesis:
      "On the trial's final day, an annual-forward framing ('annual') drives more monthly→annual " +
      "switches than the transparency-first framing ('control'). The annual plan is genuinely cheaper " +
      "($39.99/yr vs $4.99/mo) — no discount is promised.",
    variants: ["control", "annual"],
    primaryEvent: "annual_switch",
    // 8% baseline annual-switch, +3pp MDE; conversion stays "running" / null until real switches are
    // logged (never fabricated). Floor at 100 for early signal.
    minSamplePerArm: Math.max(100, minSampleSizePerArm(0.08, 0.03)),
  },
];

/**
 * Look up an experiment definition by id.
 * Returns `undefined` when the id is unknown — callers should handle missing gracefully.
 */
export function getExperiment(id: string): ExperimentDefinition | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}
