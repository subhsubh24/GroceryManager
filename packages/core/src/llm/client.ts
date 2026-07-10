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
import { GoogleGenAI, MediaResolution, type Content, type Part } from "@google/genai";
import { loadEnv, useVertex, type Env } from "@gm/config/env";
import { EMBEDDING_DIM, EMBEDDING_MODEL, type GeminiTier } from "@gm/config/constants";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { nextTier, resolveModel, thinkingBudgetFor } from "./models.js";
import type { Tool, ToolContext } from "./semantic-layer.js";

export interface ImagePart {
  mimeType: string;
  dataBase64: string;
}

export interface GenerateOptions {
  tier?: GeminiTier;
  system?: string;
  /** Optional images for vision tasks (pantry scans, receipt photos). */
  images?: ImagePart[];
  /**
   * Per-request image detail (Gemini `mediaResolution`). `high` does a zoomed reframing that
   * resolves small/partially-occluded items far better — the right call for dense shelf/fridge
   * detection; `low` (64 tok) is enough for large-text OCR. Omitted → the model's default.
   */
  mediaResolution?: "low" | "medium" | "high";
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

/**
 * Heuristic: does this error look like the API REJECTING the combination of `functionDeclarations` +
 * `codeExecution` (an argument/schema 400), as opposed to a transient failure? We only want to drop
 * code execution for the former — never for a 429/500/network blip. Matches the 400 / INVALID_ARGUMENT
 * signatures and a mention of code execution / tool incompatibility in the message.
 */
function isToolCombineRejection(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  const looksLikeBadRequest =
    msg.includes("400") || msg.includes("invalid_argument") || msg.includes("invalid argument");
  const mentionsToolConflict =
    msg.includes("code execution") ||
    msg.includes("codeexecution") ||
    msg.includes("function") ||
    msg.includes("tool") ||
    msg.includes("not supported") ||
    msg.includes("cannot be") ||
    msg.includes("combine");
  return looksLikeBadRequest && mentionsToolConflict;
}

/**
 * Gemini's `functionResponse.response` must be a JSON object. Tool handlers may return a primitive or
 * an array (or even `undefined`), so wrap anything that isn't a plain object under a `result` key.
 */
function toResponseObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { result: value ?? null };
}

/** Map our compact resolution hint to the SDK enum (undefined → leave the model's default). */
function mediaResolutionEnum(r?: "low" | "medium" | "high"): MediaResolution | undefined {
  if (r === "low") return MediaResolution.MEDIA_RESOLUTION_LOW;
  if (r === "medium") return MediaResolution.MEDIA_RESOLUTION_MEDIUM;
  if (r === "high") return MediaResolution.MEDIA_RESOLUTION_HIGH;
  return undefined;
}

/** Default per-call LLM timeout (ms). A slow / rate-limited (e.g. free-tier) key must fail FAST so
 *  callers can degrade gracefully WITHIN the serverless function budget — otherwise the underlying
 *  SDK call (with its own internal retries/backoff) runs until the function is KILLED, the caller's
 *  try/catch never runs, and the user hits a dead-end instead of the graceful fallback. Keep this
 *  comfortably under the smallest function limit (Vercel Hobby is 10s). Override via LLM_TIMEOUT_MS. */
const DEFAULT_LLM_TIMEOUT_MS = 8_000;

/** Reject `p` if it doesn't settle within `ms`, so one stuck Gemini call can't hang the whole request. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Gemini call exceeded ${ms}ms timeout (${label})`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export class GeminiClient {
  private readonly ai: GoogleGenAI;
  private readonly env: Env;

  /** Per-call wall-clock budget for a single Gemini request (see DEFAULT_LLM_TIMEOUT_MS). */
  private get callTimeoutMs(): number {
    return this.env.LLM_TIMEOUT_MS ?? DEFAULT_LLM_TIMEOUT_MS;
  }

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
    const mediaRes = mediaResolutionEnum(opts.mediaResolution);

    // Code-execution mode: the model runs Python for deterministic values, then returns JSON in its
    // final text part (tools can't be combined with JSON response-schema mode — verified, 400).
    if (opts.codeExecution) {
      const parts: Part[] = [{ text: codeExecPrompt(prompt, jsonSchema) }];
      for (const img of opts.images ?? []) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
      }
      const res = await withTimeout(
        this.ai.models.generateContent({
          model,
          contents: { role: "user", parts },
          config: {
            tools: [{ codeExecution: {} }],
            ...(opts.system ? { systemInstruction: opts.system } : {}),
            ...(mediaRes ? { mediaResolution: mediaRes } : {}),
          },
        }),
        this.callTimeoutMs,
        `generateStructured/codeExec ${model}`,
      );
      return schema.parse(extractJsonValue(res.text ?? "")) as z.infer<S>;
    }

    const budget = opts.thinkingBudget ?? thinkingBudgetFor(tier);
    const parts: Part[] = [{ text: prompt }];
    for (const img of opts.images ?? []) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
    }
    const contents: Content = { role: "user", parts };

    const res = await withTimeout(
      this.ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          // Gemini accepts an OpenAPI-subset schema; zod-to-json-schema is close enough for
          // most shapes. (Enums need an explicit "type":"string" — handled at schema authoring.)
          responseSchema: jsonSchema,
          ...(opts.system ? { systemInstruction: opts.system } : {}),
          ...(mediaRes ? { mediaResolution: mediaRes } : {}),
          ...(budget !== -1 ? { thinkingConfig: { thinkingBudget: budget } } : {}),
        },
      }),
      this.callTimeoutMs,
      `generateStructured ${model}`,
    );

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
    const res = await withTimeout(
      this.ai.models.generateContent({
        model,
        contents,
        config: {
          ...(args.codeExecution ? { tools: [{ codeExecution: {} }] } : {}),
          ...(args.system ? { systemInstruction: args.system } : {}),
        },
      }),
      this.callTimeoutMs,
      `chat ${model}`,
    );
    return { text: res.text ?? "" };
  }

  /**
   * Agentic chat — drives Gemini's FUNCTION-CALLING loop over a semantic-layer tool set (§8.2). The
   * model decides which tools to call; we execute the matching deterministic handler, feed the result
   * back as a `functionResponse`, and resend, until the model stops calling tools or `maxSteps` is hit
   * (the circuit breaker that guarantees termination). With `codeExecution` we also enable the
   * code-execution tool so the model computes any numbers in Python.
   *
   * Some models reject combining `functionDeclarations` with `codeExecution` (400). We catch that on
   * the FIRST call and transparently retry with functionDeclarations only — the chat never fails just
   * because the two tools can't be combined.
   */
  async runChatWithTools(args: {
    messages: ChatTurn[];
    system?: string;
    tools: Tool[];
    ctx: ToolContext;
    codeExecution?: boolean;
    tier?: GeminiTier;
    /** Hard cap on tool-call rounds (the loop's circuit breaker). Default 8. */
    maxSteps?: number;
  }): Promise<{ text: string; steps: number }> {
    const tier = args.tier ?? "cheap";
    const model = resolveModel(tier, this.env.LLM_USE_FLASH_LITE);
    const maxSteps = Math.max(1, args.maxSteps ?? 8);
    const byName = new Map(args.tools.map((t) => [t.name, t]));

    const functionDeclarations = args.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    }));

    // Config builder so we can rebuild with/without code execution on the combine-fallback path.
    const buildConfig = (withCodeExec: boolean) => ({
      tools: [
        { functionDeclarations },
        ...(withCodeExec ? [{ codeExecution: {} }] : []),
      ],
      ...(args.system ? { systemInstruction: args.system } : {}),
    });

    const contents: Content[] = args.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let allowCodeExec = Boolean(args.codeExecution);
    let steps = 0;

    // Wrap the whole loop so ANY throw (a later-round call, the code-exec retry, or the final summary)
    // carries the partial `steps` count out to the caller as a ChatToolLoopError. `steps` is bumped
    // before each call, so it equals the number of Gemini calls actually issued when the loop fails —
    // letting the caller settle the per-user spend quota for the partial loop, not a flat 1.
    try {
      while (steps < maxSteps) {
        steps++;
        let res: Awaited<ReturnType<typeof this.ai.models.generateContent>>;
        try {
          res = await withTimeout(
            this.ai.models.generateContent({ model, contents, config: buildConfig(allowCodeExec) }),
            this.callTimeoutMs,
            `runChatWithTools ${model}`,
          );
        } catch (e) {
          // SOME models reject combining functionDeclarations + codeExecution (400 INVALID_ARGUMENT). That
          // shows up on the FIRST call (the tool config is identical every round), so only retry-without-
          // code-execution on step 1 and only when the error looks like an argument rejection. Any other
          // error (transient 429/500/network, or a later-round failure) is rethrown so we don't silently
          // and permanently drop code execution and start predicting numbers.
          if (allowCodeExec && steps === 1 && isToolCombineRejection(e)) {
            allowCodeExec = false;
            res = await withTimeout(
              this.ai.models.generateContent({ model, contents, config: buildConfig(false) }),
              this.callTimeoutMs,
              `runChatWithTools ${model} (no code-exec)`,
            );
          } else {
            throw e;
          }
        }

        const calls = res.functionCalls ?? [];
        if (calls.length === 0) {
          return { text: res.text ?? "", steps };
        }

        // Append the model's function-call turn so the next request pairs responses to it. Echo the
        // candidate content verbatim ONLY when it actually carries the function-call parts (preserving
        // any ids / thoughts the API may pair on); otherwise reconstruct a clean model turn from `calls`
        // so we never desync the functionCall/functionResponse pairing.
        const modelContent = res.candidates?.[0]?.content;
        const echoable = modelContent?.parts?.some((p) => p.functionCall) ?? false;
        contents.push(echoable ? modelContent! : { role: "model", parts: calls.map((fc) => ({ functionCall: fc })) });

        // Execute each requested tool (deterministic, session-scoped, never-throwing handlers) and
        // return one functionResponse part per call so the model can read the results next round.
        const responseParts: Part[] = [];
        for (const call of calls) {
          const tool = call.name ? byName.get(call.name) : undefined;
          const response = tool
            ? await tool.handler(call.args ?? {}, args.ctx)
            : { error: `unknown tool: ${call.name ?? "(unnamed)"}` };
          responseParts.push({
            functionResponse: {
              ...(call.id ? { id: call.id } : {}),
              name: call.name ?? "unknown",
              // Wrap non-object results so the API always gets a JSON object for `response`.
              response: toResponseObject(response),
            },
          });
        }
        contents.push({ role: "user", parts: responseParts });
      }

      // Hit the step cap — make ONE final call with no tools so the model summarizes what it has.
      const finalRes = await withTimeout(
        this.ai.models.generateContent({
          model,
          contents,
          ...(args.system ? { config: { systemInstruction: args.system } } : {}),
        }),
        this.callTimeoutMs,
        `runChatWithTools ${model} (final summary)`,
      );
      return { text: finalRes.text ?? "", steps };
    } catch (e) {
      // Any throw here means a call already succeeded this loop OR the current call failed — either way
      // `steps` is the real number of Gemini calls issued. Re-throw carrying that count so the caller
      // settles the per-user spend quota for the partial loop instead of a flat 1 (the spend-ceiling
      // under-count fixed here). Preserve an already-typed error rather than double-wrapping.
      throw e instanceof ChatToolLoopError ? e : new ChatToolLoopError(steps, e);
    }
  }

  /**
   * Embed text to a normalized EMBEDDING_DIM-d vector (gemini-embedding-001, MRL-truncated). Powers
   * the §5.4 semantic match stage. MRL-truncated vectors come back un-normalized, so we L2-normalize
   * (required before cosine comparison against the pgvector index).
   */
  async embed(text: string): Promise<number[]> {
    const res = await withTimeout(
      this.ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIM },
      }),
      this.callTimeoutMs,
      `embed ${EMBEDDING_MODEL}`,
    );
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

/**
 * Thrown by {@link GeminiClient.runChatWithTools} when the agentic loop fails PART-WAY through. It
 * carries `stepsAttempted` — the number of Gemini calls already issued when the failure happened — so
 * the caller can settle its per-user LLM spend quota against the REAL call count on the throw path,
 * not a flat 1 (which would under-count the per-user/day spend ceiling by up to `maxSteps`× when a
 * multi-step ask throws mid-loop). `cause` is the underlying error.
 */
export class ChatToolLoopError extends Error {
  constructor(
    public readonly stepsAttempted: number,
    public override readonly cause: unknown,
  ) {
    super(
      `runChatWithTools failed after ${stepsAttempted} step(s): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = "ChatToolLoopError";
  }
}

let _client: GeminiClient | null = null;
export function getGeminiClient(): GeminiClient {
  if (!_client) _client = new GeminiClient();
  return _client;
}
