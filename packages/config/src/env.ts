import { z } from "zod";

/**
 * Single, validated source of truth for environment configuration.
 * Import `env` anywhere in core/workers; never read `process.env` directly.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Core infra
  // App connection — on Supabase use the Transaction pooler URL (port 6543).
  DATABASE_URL: z.string().url(),
  // Direct (non-pooled) connection for migrations — Supabase port 5432.
  DIRECT_DATABASE_URL: z.string().url().optional(),
  // Optional app-wide: only the worker service requires it (it guards at startup).
  REDIS_URL: z.string().url().optional(),

  // LLM — Gemini via @google/genai. Dev uses GEMINI_API_KEY; prod prefers Vertex AI.
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_VERTEX_PROJECT: z.string().optional(),
  GOOGLE_VERTEX_LOCATION: z.string().default("us-central1"),
  // Flash-Lite is public preview; when false we fall back to gemini-2.5-flash everywhere.
  LLM_USE_FLASH_LITE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Auth + Gmail (read-only)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  KMS_KEY_ID: z.string().optional(),

  // Integrations
  INSTACART_API_KEY: z.string().optional(),
  SPOONACULAR_API_KEY: z.string().optional(),
  AMAZON_ASSOCIATE_TAG: z.string().optional(),

  // Object storage (S3-compatible)
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default("grocery-manager"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Parse + validate process.env once. Throws a readable error on misconfig. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Whether to route LLM calls through Vertex AI (prod) vs the Developer API (dev). */
export function useVertex(env: Env): boolean {
  return Boolean(env.GOOGLE_VERTEX_PROJECT);
}
