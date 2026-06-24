import { loadEnv } from "@gm/config/env";
import { OnboardingFlow } from "./onboarding-flow";

export const dynamic = "force-dynamic";

/**
 * Onboarding entry — a mobile-first TILE step-flow (Profile → Taste → Add first items → Done), NOT a
 * chat. The TASTE step adapts to whether a Gemini key is configured:
 *   • with a key  → the AI-adaptive engine (`nextOnboardingTurn`) rendered as tiles (question heading
 *                   + suggested-answer chips + a "type your own" input), one question per screen;
 *   • without one → the deterministic chip wizard, restyled to match.
 * Both write to the SAME preference ledger via the server actions in `./actions` and finish by
 * re-projecting the materialized UserModel and redirecting to "/". We only pass a boolean down so the
 * server-only LLM is never imported by the client component (it's reached solely through the actions).
 */
export default function OnboardingPage() {
  const env = loadEnv();
  const hasAi = !!(env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT);
  return <OnboardingFlow hasAi={hasAi} />;
}
