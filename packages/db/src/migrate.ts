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

    console.log("✓ migrations complete");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
