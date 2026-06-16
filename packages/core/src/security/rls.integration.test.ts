/**
 * Row-Level Security enforcement (PLAN §11). Proves isolation at the DB, not just in app code.
 * Skipped unless both connections are provided:
 *   RLS_TEST_ADMIN_URL    — owner/superuser (provisioning; bypasses RLS)
 *   RLS_TEST_DATABASE_URL — restricted app_user (member of grocery_app; subject to RLS)
 * Run sql/0002_rls.sql (via db:migrate) and `CREATE ROLE app_user LOGIN … IN ROLE grocery_app;` first.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, withTenant, shoppingLists, unitsOfMeasure, users } from "@gm/db";

const APP_URL = process.env.RLS_TEST_DATABASE_URL;
const ADMIN_URL = process.env.RLS_TEST_ADMIN_URL;
const run = APP_URL && ADMIN_URL ? describe : describe.skip;

run("row-level security enforcement", () => {
  const admin = createDb(ADMIN_URL!);
  const app = createDb(APP_URL!);
  let userA = "";
  let userB = "";
  let listB = "";

  beforeAll(async () => {
    const stamp = Date.now();
    const [a] = await admin.db
      .insert(users)
      .values({ email: `rls-a-${stamp}@test.local` })
      .returning({ id: users.id });
    const [b] = await admin.db
      .insert(users)
      .values({ email: `rls-b-${stamp}@test.local` })
      .returning({ id: users.id });
    userA = a!.id;
    userB = b!.id;
    await admin.db.insert(shoppingLists).values({ userId: userA, name: "A list" });
    const [lb] = await admin.db
      .insert(shoppingLists)
      .values({ userId: userB, name: "B list" })
      .returning({ id: shoppingLists.id });
    listB = lb!.id;
  });

  afterAll(async () => {
    if (userA) await admin.db.delete(users).where(eq(users.id, userA));
    if (userB) await admin.db.delete(users).where(eq(users.id, userB));
    await admin.client.end();
    await app.client.end();
  });

  it("a tenant sees only its own rows", async () => {
    const rows = await withTenant(app.db, userA, (tx) => tx.select().from(shoppingLists));
    expect(rows.length).toBe(1);
    expect(rows.every((r) => r.userId === userA)).toBe(true);
  });

  it("a tenant cannot read another tenant's row, even by id", async () => {
    const rows = await withTenant(app.db, userA, (tx) =>
      tx.select().from(shoppingLists).where(eq(shoppingLists.id, listB)),
    );
    expect(rows.length).toBe(0);
  });

  it("denies by default when no tenant context is set", async () => {
    const rows = await app.db.select().from(shoppingLists);
    expect(rows.length).toBe(0);
  });

  it("forbids inserting a row for another tenant (WITH CHECK)", async () => {
    await expect(
      withTenant(app.db, userA, (tx) =>
        tx.insert(shoppingLists).values({ userId: userB, name: "sneaky" }),
      ),
    ).rejects.toThrow();
  });

  it("still allows reading the shared catalog (no RLS)", async () => {
    const rows = await withTenant(app.db, userA, (tx) => tx.select().from(unitsOfMeasure).limit(1));
    expect(Array.isArray(rows)).toBe(true);
  });
});
