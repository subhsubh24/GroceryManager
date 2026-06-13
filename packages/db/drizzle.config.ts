import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // pgvector + pg_trgm are created in sql/0000_extensions.sql (run by migrate.ts before migrations).
  verbose: true,
  strict: true,
});
