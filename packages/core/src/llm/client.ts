/**
 * Gemini client (PLAN §8) — cheap-first model router + structured output + the
 * loop-engineering "verify-then-escalate" helper.
 *
 *   generateStructured : one schema-constrained call at a given tier (Zod-validated).
 *   generateWithVerify : act → validate(Zod) → verify(cheap/rules) → escalate a tier → give up.
 *
 * Reliability comes from this loop + the semantic layer, not from the model — so the
 * default tier is the cheapest (gemini-2.5-flash-lite).
 */
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { loadEnv, useVertex, type Env } from "@gm/config/env";
import type { GeminiTier } from "@gm/config/constants";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { nextTier, resolveModel, thinkingBudgetFor } from "./models.js";

export interface ImagePart {
  mimeType: string;
  dataBase64: string;
}

export interface GenerateOptions {
  tier?: GeminiTier;
  system?: string;
  /** Optional images for vision tasks (pantry scans, receipt photos). */
  images?: ImagePart[];
  /** Override the per-tier default thinking budget. */
  thinkingBudget?: number;
}

/** A cheap, separate verification step — "the call that wrote it doesn't grade it." */
export type Verifier<T> = (value: T) => { ok: true } | { ok: false; reason: string };

export interface VerifyOptions<T> extends GenerateOptions {
  schema: z.ZodType<T>;
  prompt: string;
  verify?: Verifier<T>;
  /** Max total attempts across escalation (the circuit breaker). */
  maxAttempts?: number;
}

export interface VerifyResult<T> {
  value: T;
  tierUsed: GeminiTier;
  attempts: number;
  verified: boolean;
}

export class GeminiClient {
  private readonly ai: GoogleGenAI;
  private readonly env: Env;

  constructor(env: Env = loadEnv()) {
    this.env = env;
    this.ai = useVertex(env)
      ? new GoogleGenAI({
          vertexai: true,
          project: env.GOOGLE_VERTEX_PROJECT,
          location: env.GOOGLE_VERTEX_LOCATION,
        })
      : new GoogleGenAI({ apiKey: env.GEMINI_API_KEY ?? "" });
  }

  /** One schema-constrained generation at `tier`; result is parsed + validated with Zod. */
  async generateStructured<T>(
    schema: z.ZodType<T>,
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<T> {
    const tier = opts.tier ?? "cheap";
    const model = resolveModel(tier, this.env.LLM_USE_FLASH_LITE);
    const budget = opts.thinkingBudget ?? thinkingBudgetFor(tier);

    const parts: Part[] = [{ text: prompt }];
    for (const img of opts.images ?? []) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
    }
    const contents: Content = { role: "user", parts };

    const res = await this.ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        // Gemini accepts an OpenAPI-subset schema; zod-to-json-schema is close enough for
        // most shapes. (Enums need an explicit "type":"string" — handled at schema authoring.)
        responseSchema: zodToJsonSchema(schema, { target: "openApi3" }) as object,
        ...(opts.system ? { systemInstruction: opts.system } : {}),
        ...(budget !== -1 ? { thinkingConfig: { thinkingBudget: budget } } : {}),
      },
    });

    const text = res.text ?? "";
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned non-JSON at tier=${tier}: ${text.slice(0, 200)}`);
    }
    return schema.parse(json); // re-validate — structured output is syntactic, not semantic
  }

  /**
   * Loop-engineered generation: start cheap, validate with Zod, run the (optional) cheap
   * verifier, and on failure retry with more context / escalate a tier until a budget trips.
   * Tripping the budget is the circuit breaker — callers route the result to the Review inbox.
   */
  async generateWithVerify<T>(opts: VerifyOptions<T>): Promise<VerifyResult<T>> {
    const maxAttempts = opts.maxAttempts ?? 3;
    let tier: GeminiTier = opts.tier ?? "cheap";
    let attempts = 0;
    let lastErr = "";

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const prompt = lastErr
          ? `${opts.prompt}\n\n# Previous attempt failed verification\nReason: ${lastErr}\nReturn a corrected result.`
          : opts.prompt;

        const value = await this.generateStructured(opts.schema, prompt, { ...opts, tier });

        const verdict = opts.verify ? opts.verify(value) : ({ ok: true } as const);
        if (verdict.ok) {
          return { value, tierUsed: tier, attempts, verified: Boolean(opts.verify) };
        }
        lastErr = verdict.reason;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }

      const up = nextTier(tier);
      if (up) tier = up; // escalate; otherwise retry the top tier until attempts run out
    }

    throw new VerificationExhaustedError(lastErr, attempts);
  }
}

export class VerificationExhaustedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly attempts: number,
  ) {
    super(`LLM verify-then-escalate exhausted after ${attempts} attempts: ${reason}`);
    this.name = "VerificationExhaustedError";
  }
}

let _client: GeminiClient | null = null;
export function getGeminiClient(): GeminiClient {
  if (!_client) _client = new GeminiClient();
  return _client;
}
