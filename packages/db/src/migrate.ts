/**
 * Migration runner: extensions → Drizzle migrations → custom indexes.
 * Run with: pnpm --filter @gm/db db:migrate
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "@gm/config/env";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");

async function main() {
  const env = loadEnv();
  // Run migrations on the DIRECT connection (the Supabase pooler can't run all DDL).
  const sql = postgres(env.DIRECT_DATABASE_URL ?? env.DATABASE_URL, { max: 1 });
  try {
    console.log("→ creating extensions…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0000_extensions.sql"), "utf8"));

    console.log("→ running Drizzle migrations…");
    await migrate(drizzle(sql), { migrationsFolder: join(pkgRoot, "drizzle") });

    console.log("→ creating custom indexes…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0001_indexes.sql"), "utf8"));

    console.log("→ applying row-level security…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0002_rls.sql"), "utf8"));

    console.log("→ supplements vertical + dosage columns…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0003_supplements.sql"), "utf8"));

    console.log("→ credentials login (users.password_hash)…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0004_password.sql"), "utf8"));

    console.log("→ shared household (opt-in shared shopping list)…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0005_households.sql"), "utf8"));

    console.log("→ username login (users.username + email optional)…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0006_username.sql"), "utf8"));

    console.log("→ cook-log macros (meal_logs kcal/protein/carbs/fat + source)…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0007_macros.sql"), "utf8"));

    console.log("→ performance indexes (hot per-user read paths)…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0008_perf_indexes.sql"), "utf8"));

    console.log("→ SMS digest channel (users.phone)…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0009_notifications.sql"), "utf8"));

    console.log("→ RLS on shared catalog tables…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0010_rls_catalog.sql"), "utf8"));

    console.log("→ Expo mobile push token table…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0011_push_tokens.sql"), "utf8"));

    console.log("→ waitlist submissions table…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0012_waitlist.sql"), "utf8"));

    console.log("→ UTM attribution on waitlist_submissions…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0013_utm_tracking.sql"), "utf8"));

    console.log("→ content schedule table…");
    await sql.unsafe(readFileSync(join(pkgRoot, "sql/0014_content_schedule.sql"), "utf8"));

    console.log("✓ migrations complete");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
