import {
  appendPreferenceSignal,
  getDb,
  isOnboarded,
  loadPreferenceSignals,
  persistUserModel,
  withTenant,
} from "@gm/db";
import {
  answersToSignals,
  projectUserModel,
  signalFromProfileAge,
  signalFromProfileGender,
  signalFromProfileName,
  type OnboardingAnswers,
} from "@gm/core/personalization";
import { verifyMobileToken } from "../_lib";
import { parseJsonBody } from "../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";

function authGuard(req: Request): { userId: string } | Response {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  return { userId };
}

export async function GET(req: Request) {
  const guard = authGuard(req);
  if (guard instanceof Response) return guard;
  const { userId } = guard;

  const rl = rateLimit(`onboarding-read:${userId}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const onboarded = await withTenant(getDb(), userId, (tx) => isOnboarded(tx, userId));
    return Response.json({ onboarded });
  } catch (err) {
    // A DB failure must return a controlled 503, not an uncaught 500 with a stack.
    console.error("[mobile/onboarding]", err);
    return Response.json({ error: "Onboarding temporarily unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const guard = authGuard(req);
  if (guard instanceof Response) return guard;
  const { userId } = guard;

  const rl = rateLimit(`onboarding-write:${userId}`, 30, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const bodyOrErr = await parseJsonBody<Record<string, unknown>>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const action = typeof body.action === "string" ? body.action : null;

  // A DB failure inside any write branch returns a controlled 503, not an uncaught 500 with a stack.
  try {
    if (action === "profile") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const rawAge = typeof body.age === "string" ? Number(body.age.trim()) : typeof body.age === "number" ? body.age : 0;
      const gender = typeof body.gender === "string" ? body.gender.trim() : "";
      const signals = [
        ...(name ? [signalFromProfileName(name)] : []),
        ...(Number.isFinite(rawAge) && rawAge > 0 ? [signalFromProfileAge(rawAge)] : []),
        ...(gender ? [signalFromProfileGender(gender)] : []),
      ];
      if (signals.length > 0) {
        await withTenant(getDb(), userId, async (tx) => {
          for (const s of signals) {
            await appendPreferenceSignal(tx, {
              userId,
              topic: s.topic,
              value: s.value ?? null,
              polarity: s.polarity,
              source: "onboarding_q",
              confidence: s.confidence,
            });
          }
        });
      }
      return Response.json({ ok: true });
    }

    if (action === "taste") {
      const toStrArr = (v: unknown): string[] =>
        Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const toIngredients = (v: unknown): string[] =>
        typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

      const answers: OnboardingAnswers = {
        diets: toStrArr(body.diets),
        allergens: toStrArr(body.allergens),
        lovedCuisines: toStrArr(body.lovedCuisines),
        lovedIngredients: toIngredients(body.lovedIngredients),
        dislikedIngredients: toIngredients(body.dislikedIngredients),
      };
      const signals = answersToSignals(answers);
      if (signals.length > 0) {
        await withTenant(getDb(), userId, async (tx) => {
          for (const s of signals) {
            await appendPreferenceSignal(tx, {
              userId,
              topic: s.topic,
              value: s.value ?? null,
              polarity: s.polarity,
              source: "onboarding_q",
              confidence: s.confidence,
            });
          }
        });
      }
      return Response.json({ ok: true });
    }

    if (action === "finish") {
      // Idempotent: if already onboarded, return early without re-projecting or appending duplicate rows.
      const alreadyDone = await withTenant(getDb(), userId, (tx) => isOnboarded(tx, userId));
      if (alreadyDone) return Response.json({ ok: true });

      await withTenant(getDb(), userId, async (tx) => {
        const model = projectUserModel(await loadPreferenceSignals(tx, userId));
        await persistUserModel(tx, userId, {
          diets: model.diets,
          allergens: model.allergens,
          cuisineAffinity: model.cuisineAffinity,
          qualityPrefs: model.qualityPrefs,
          confidencePerField: model.confidencePerField,
        });
        await appendPreferenceSignal(tx, {
          userId,
          topic: "onboarded",
          value: "true",
          polarity: "positive",
          source: "onboarding_q",
          confidence: 1,
        });
      });
      return Response.json({ ok: true });
    }

    return Response.json(
      { error: 'Unknown action. Expected "profile", "taste", or "finish".' },
      { status: 400 },
    );
  } catch (err) {
    console.error("[mobile/onboarding]", err);
    return Response.json({ error: "Onboarding temporarily unavailable" }, { status: 503 });
  }
}
