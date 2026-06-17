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
import { EMBEDDING_DIM, EMBEDDING_MODEL, type GeminiTier } from "@gm/config/constants";
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
  /**
   * Enable the Gemini code-execution tool so the model computes deterministic values (amounts in
   * cents, totals, counts) by running Python instead of predicting them. Mutually exclusive with
   * JSON response-schema mode (the API rejects `tools` + `responseMimeType: application/json`), so
   * in this mode we ask for JSON in the final text part and parse it. Use it for math-bearing tasks.
   */
  codeExecution?: boolean;
}

/** One turn of a free-text conversation (mirrors the public ChatMessage shape). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  tier?: GeminiTier;
  system?: string;
  /**
   * Enable the Gemini code-execution tool so the model runs Python for any math/trend instead of
   * predicting numbers. Same wiring as `generateStructured` — adds `tools: [{ codeExecution: {} }]`.
   */
  codeExecution?: boolean;
}

/** A cheap, separate verification step — "the call that wrote it doesn't grade it." */
export type Verifier<T> = (value: T) => { ok: true } | { ok: false; reason: string };

export interface VerifyOptions<S extends z.ZodTypeAny> extends GenerateOptions {
  schema: S;
  prompt: string;
  verify?: Verifier<z.infer<S>>;
  /** Max total attempts across escalation (the circuit breaker). */
  maxAttempts?: number;
}

export interface VerifyResult<T> {
  value: T;
  tierUsed: GeminiTier;
  attempts: number;
  verified: boolean;
}

/** Wrap a prompt so the model computes numbers with Python, then emits only schema-shaped JSON. */
function codeExecPrompt(prompt: string, jsonSchema: object): string {
  return (
    `${prompt}\n\n` +
    "Compute every numeric value (amounts in cents, totals, counts) by writing and running Python — " +
    "do not do arithmetic in your head. Then return ONLY one JSON object matching this schema, with " +
    `no commentary and no markdown fences:\n${JSON.stringify(jsonSchema)}`
  );
}

/**
 * Pull a JSON value out of a code-execution text response, which may be clean JSON, fenced, or
 * wrapped in prose (cheaper tiers are chatty). Grabs the outermost object/array span and parses it.
 */
export function extractJsonValue(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1]! : text;
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end <= start) {
    throw new Error(`no JSON found in code-execution output: ${text.slice(0, 160)}`);
  }
  return JSON.parse(body.slice(start, end + 1));
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
  async generateStructured<S extends z.ZodTypeAny>(
    schema: S,
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<z.infer<S>> {
    const tier = opts.tier ?? "cheap";
    const model = resolveModel(tier, this.env.LLM_USE_FLASH_LITE);
    const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" }) as object;

    // Code-execution mode: the model runs Python for deterministic values, then returns JSON in its
    // final text part (tools can't be combined with JSON response-schema mode — verified, 400).
    if (opts.codeExecution) {
      const parts: Part[] = [{ text: codeExecPrompt(prompt, jsonSchema) }];
      for (const img of opts.images ?? []) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
      }
      const res = await this.ai.models.generateContent({
        model,
        contents: { role: "user", parts },
        config: {
          tools: [{ codeExecution: {} }],
          ...(opts.system ? { systemInstruction: opts.system } : {}),
        },
      });
      return schema.parse(extractJsonValue(res.text ?? "")) as z.infer<S>;
    }

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
        responseSchema: jsonSchema,
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
    return schema.parse(json) as z.infer<S>; // re-validate — structured output is syntactic, not semantic
  }

  /**
   * Loop-engineered generation: start cheap, validate with Zod, run the (optional) cheap
   * verifier, and on failure retry with more context / escalate a tier until a budget trips.
   * Tripping the budget is the circuit breaker — callers route the result to the Review inbox.
   */
  async generateWithVerify<S extends z.ZodTypeAny>(
    opts: VerifyOptions<S>,
  ): Promise<VerifyResult<z.infer<S>>> {
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

  /**
   * Free-text, MULTI-TURN generation (for chat). Maps the conversation to genai `Content[]`
   * (assistant→"model"), runs one call at `tier`, and returns the final text. With
   * `codeExecution`, adds the `tools: [{ codeExecution: {} }]` tool — identical to the structured
   * path — so the model computes any numbers in Python. Tools can't be combined with a JSON
   * response-schema, but chat wants free text anyway, so there's no schema here (we read `res.text`).
   */
  async chat(args: { messages: ChatTurn[]; system?: string } & ChatOptions): Promise<{ text: string }> {
    const tier = args.tier ?? "cheap";
    const model = resolveModel(tier, this.env.LLM_USE_FLASH_LITE);
    const contents: Content[] = args.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const res = await this.ai.models.generateContent({
      model,
      contents,
      config: {
        ...(args.codeExecution ? { tools: [{ codeExecution: {} }] } : {}),
        ...(args.system ? { systemInstruction: args.system } : {}),
      },
    });
    return { text: res.text ?? "" };
  }

  /**
   * Embed text to a normalized EMBEDDING_DIM-d vector (gemini-embedding-001, MRL-truncated). Powers
   * the §5.4 semantic match stage. MRL-truncated vectors come back un-normalized, so we L2-normalize
   * (required before cosine comparison against the pgvector index).
   */
  async embed(text: string): Promise<number[]> {
    const res = await this.ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: EMBEDDING_DIM },
    });
    const values = res.embeddings?.[0]?.values;
    if (!values || values.length === 0) throw new Error(`empty embedding from ${EMBEDDING_MODEL}`);
    return l2normalize(values);
  }
}

/** L2-normalize a vector (required for MRL-truncated embeddings before cosine comparison). */
export function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  return norm === 0 ? v.slice() : v.map((x) => x / norm);
}

/** An `embed` adapter for the §5.4 cascade (createDbNormalizationPorts deps.embed). */
export function createGeminiEmbedder(
  client: GeminiClient = getGeminiClient(),
): (text: string) => Promise<number[]> {
  return (text) => client.embed(text);
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
