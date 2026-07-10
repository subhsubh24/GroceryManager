import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatToolLoopError, extractJsonValue, GeminiClient, l2normalize } from "./client.js";
import type { Env } from "@gm/config/env";
import type { Tool, ToolContext } from "./semantic-layer.js";

/** Minimal env so `new GeminiClient(env)` doesn't read process.env. */
const fakeEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  GEMINI_API_KEY: "test-key",
  GOOGLE_VERTEX_LOCATION: "us-central1",
  LLM_USE_FLASH_LITE: true,
  S3_BUCKET: "b",
  VAPID_SUBJECT: "mailto:a@b.c",
} as unknown as Env;

/** A fake genai response: only the fields runChatWithTools reads. */
function fakeResponse(opts: { text?: string; calls?: { name: string; args?: Record<string, unknown>; id?: string }[] }) {
  const calls = opts.calls ?? [];
  return {
    text: opts.text ?? "",
    functionCalls: calls.length ? calls : undefined,
    candidates: calls.length
      ? [{ content: { role: "model", parts: calls.map((c) => ({ functionCall: c })) } }]
      : [{ content: { role: "model", parts: [{ text: opts.text ?? "" }] } }],
  };
}

/** Build a client whose underlying genai call is driven by `script` (one entry per call). */
function clientWithScript(script: ((req: { config?: { tools?: unknown[] } }) => unknown)[]) {
  const client = new GeminiClient(fakeEnv);
  let i = 0;
  const calls: { config?: { tools?: unknown[] } }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).ai = {
    models: {
      generateContent: async (req: { config?: { tools?: unknown[] } }) => {
        calls.push(req);
        const step = script[Math.min(i, script.length - 1)]!;
        i++;
        return step(req);
      },
    },
  };
  return { client, calls, callCount: () => i };
}

const ctx: ToolContext = { userId: "u1" };

describe("l2normalize", () => {
  it("scales a vector to unit length", () => {
    const v = l2normalize([3, 4]); // |[3,4]| = 5
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
    expect(Math.hypot(...v)).toBeCloseTo(1);
  });

  it("returns zeros for a zero vector (no NaN)", () => {
    expect(l2normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("leaves an already-normalized vector unit-length", () => {
    expect(Math.hypot(...l2normalize([0, 1]))).toBeCloseTo(1);
  });
});

describe("extractJsonValue (code-execution output parsing)", () => {
  it("parses clean JSON", () => {
    expect(extractJsonValue('{"totalCents":1176}')).toEqual({ totalCents: 1176 });
  });

  it("parses a ```json fenced block", () => {
    expect(extractJsonValue('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in prose (chatty cheaper tiers)", () => {
    const text = 'The user wants the total. {"lineItems":[{"name":"Milk","cents":449}],"totalCents":449} Done.';
    expect(extractJsonValue(text)).toEqual({ lineItems: [{ name: "Milk", cents: 449 }], totalCents: 449 });
  });

  it("parses a top-level array", () => {
    expect(extractJsonValue("result: [1,2,3]")).toEqual([1, 2, 3]);
  });

  it("throws when there's no JSON to extract", () => {
    expect(() => extractJsonValue("no json here")).toThrow(/no JSON/);
  });
});

describe("runChatWithTools (function-calling loop)", () => {
  const makeTool = (name: string, handler: Tool["handler"]): Tool => ({
    name,
    description: `the ${name} tool, used for testing the function-calling loop`,
    parameters: { type: "object", properties: {} },
    handler,
  });

  it("executes a requested tool, feeds the result back, and returns the final text", async () => {
    const seen: { args: Record<string, unknown>; ctx: ToolContext }[] = [];
    const tool = makeTool("get_pantry", async (args, c) => {
      seen.push({ args, ctx: c });
      return { items: ["milk"] };
    });

    const { client, calls } = clientWithScript([
      () => fakeResponse({ calls: [{ name: "get_pantry", args: { x: 1 }, id: "call-1" }] }),
      () => fakeResponse({ text: "You have milk." }),
    ]);

    const out = await client.runChatWithTools({
      messages: [{ role: "user", content: "what do I have?" }],
      system: "sys",
      tools: [tool],
      ctx,
      codeExecution: true,
    });

    expect(out.text).toBe("You have milk.");
    expect(out.steps).toBe(2);
    // The handler ran with the parsed args and the loop's ctx.
    expect(seen).toEqual([{ args: { x: 1 }, ctx }]);
    // Second request carried a functionResponse turn with the handler's result.
    const secondContents = (calls[1] as unknown as { contents: { role: string; parts: unknown[] }[] }).contents;
    const fnResp = secondContents
      .flatMap((c) => c.parts)
      .find((p): p is { functionResponse: { name: string; response: unknown } } =>
        Boolean((p as { functionResponse?: unknown }).functionResponse),
      );
    expect(fnResp!.functionResponse).toMatchObject({ name: "get_pantry", response: { items: ["milk"] } });
  });

  it("returns immediately (one step) when the model makes no tool calls", async () => {
    const { client } = clientWithScript([() => fakeResponse({ text: "hi" })]);
    const out = await client.runChatWithTools({ messages: [{ role: "user", content: "hi" }], tools: [], ctx });
    expect(out).toEqual({ text: "hi", steps: 1 });
  });

  it("is capped by maxSteps — never loops forever even if the model always calls tools", async () => {
    let toolRuns = 0;
    const tool = makeTool("loop_tool", async () => {
      toolRuns++;
      return { ok: true };
    });
    // The model ALWAYS asks for another tool call; only maxSteps stops it.
    const { client } = clientWithScript([() => fakeResponse({ calls: [{ name: "loop_tool" }], text: "still going" })]);

    const out = await client.runChatWithTools({
      messages: [{ role: "user", content: "go" }],
      tools: [tool],
      ctx,
      maxSteps: 3,
    });
    expect(out.steps).toBe(3); // hit the cap
    expect(toolRuns).toBe(3); // one tool execution per capped round
    expect(typeof out.text).toBe("string"); // a final summarize call still returns text
  });

  it("returns { error } to the model for an unknown tool instead of throwing", async () => {
    const { client, calls } = clientWithScript([
      () => fakeResponse({ calls: [{ name: "does_not_exist", id: "c1" }] }),
      () => fakeResponse({ text: "ok" }),
    ]);
    const out = await client.runChatWithTools({ messages: [{ role: "user", content: "x" }], tools: [], ctx });
    expect(out.text).toBe("ok");
    const secondContents = (calls[1] as unknown as { contents: { parts: unknown[] }[] }).contents;
    const fnResp = secondContents
      .flatMap((c) => c.parts)
      .find((p): p is { functionResponse: { response: { error?: string } } } =>
        Boolean((p as { functionResponse?: unknown }).functionResponse),
      );
    expect(fnResp!.functionResponse.response.error).toMatch(/unknown tool/i);
  });

  it("drops code execution ONLY for a first-call tool-combine 400, then succeeds", async () => {
    let n = 0;
    const { client, calls } = clientWithScript([
      (req) => {
        n++;
        // First call includes codeExecution → simulate the API rejecting the combination.
        const hasCodeExec = (req.config?.tools ?? []).some((t) => (t as { codeExecution?: unknown }).codeExecution);
        if (n === 1 && hasCodeExec) throw new Error("400 INVALID_ARGUMENT: tool code execution is not supported with function calling");
        return fakeResponse({ text: "done without code exec" });
      },
    ]);
    const out = await client.runChatWithTools({
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      ctx,
      codeExecution: true,
    });
    expect(out.text).toBe("done without code exec");
    // Two underlying calls: the rejected one + the retry without code execution.
    expect(calls.length).toBe(2);
    const retryHadCodeExec = (calls[1]!.config?.tools ?? []).some((t) => (t as { codeExecution?: unknown }).codeExecution);
    expect(retryHadCodeExec).toBe(false);
  });

  it("does NOT misclassify a transient error as a tool-combine rejection (re-throws it)", async () => {
    const { client } = clientWithScript([
      () => {
        throw new Error("503 Service Unavailable (transient)");
      },
    ]);
    await expect(
      client.runChatWithTools({ messages: [{ role: "user", content: "hi" }], tools: [], ctx, codeExecution: true }),
    ).rejects.toThrow(/503/);
  });

  it("throws ChatToolLoopError carrying the REAL call count when a LATER round fails (spend settlement)", async () => {
    // Round 1 makes a tool call (1 Gemini call); round 2's call throws a transient 429. The caller must
    // learn that TWO calls were issued so it settles the per-user spend quota for the partial loop — a
    // flat 1 would under-count the spend ceiling by up to maxSteps× when a multi-step ask throws.
    const tool = makeTool("get_pantry", async () => ({ items: ["milk"] }));
    const { client } = clientWithScript([
      () => fakeResponse({ calls: [{ name: "get_pantry", id: "c1" }] }),
      () => {
        throw new Error("429 rate limited mid-loop");
      },
    ]);
    const err = await client
      .runChatWithTools({ messages: [{ role: "user", content: "big" }], tools: [tool], ctx })
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ChatToolLoopError);
    expect((err as ChatToolLoopError).stepsAttempted).toBe(2); // both calls issued → charge 2, not 1
    expect((err as ChatToolLoopError).message).toMatch(/429/); // the underlying cause is preserved
  });
});

describe("LLM call timeout (self-bounds a slow/stalled key)", () => {
  // A slow / rate-limited (free-tier) key must FAIL FAST so the caller's try/catch runs and degrades
  // gracefully WITHIN the serverless budget — instead of the model call hanging until the function is
  // killed (which dead-ends the user). Regression test for the onboarding "didn't go through" bug.
  const envFast = { ...fakeEnv, LLM_TIMEOUT_MS: 30 } as unknown as Env;

  it("generateStructured rejects with a timeout when the model call stalls past the budget", async () => {
    const client = new GeminiClient(envFast);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).ai = { models: { generateContent: () => new Promise(() => {}) } }; // never settles
    await expect(client.generateStructured(z.object({ ok: z.boolean() }), "hi")).rejects.toThrow(/timeout/i);
  });

  it("does NOT time out a fast call (resolves normally under the budget)", async () => {
    const client = new GeminiClient(envFast);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).ai = { models: { generateContent: async () => ({ text: '{"ok":true}' }) } };
    await expect(client.generateStructured(z.object({ ok: z.boolean() }), "hi")).resolves.toEqual({ ok: true });
  });

  it("runChatWithTools rejects with a timeout when the model call stalls (the `ask` agentic loop — its priciest surface)", async () => {
    const client = new GeminiClient(envFast);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).ai = { models: { generateContent: () => new Promise(() => {}) } }; // never settles
    await expect(
      client.runChatWithTools({ messages: [{ role: "user", content: "hi" }], tools: [], ctx }),
    ).rejects.toThrow(/timeout/i);
  });

  it("embed rejects with a timeout when the embedding call stalls (receipt-ingestion semantic match)", async () => {
    const client = new GeminiClient(envFast);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).ai = { models: { embedContent: () => new Promise(() => {}) } }; // never settles
    await expect(client.embed("milk")).rejects.toThrow(/timeout/i);
  });
});
