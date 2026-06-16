/**
 * Cross-household RLS isolation for the opt-in shared shopping list (FEATURE_HOUSEHOLDS).
 *
 * Proves isolation at the DATABASE (not just app code): every read/write goes through the REAL Postgres
 * row-level security policies (sql/0002_rls.sql + sql/0005_households.sql) via the real client
 * (`createDb` + `withTenant`) as the restricted, non-owner app role — the only way RLS actually bites.
 *
 * Skipped unless BOTH connections are provided (so unit CI without a DB stays green):
 *   RLS_TEST_ADMIN_URL    — owner/superuser (provisioning; bypasses RLS)
 *   RLS_TEST_DATABASE_URL — restricted app_user (member of grocery_app; subject to RLS)
 * The target DB must already be migrated (pnpm --filter @gm/db db:migrate, which now applies
 * sql/0005_households.sql) and `CREATE ROLE app_user LOGIN … IN ROLE grocery_app;` must exist.
 *
 * Scenario: A1 + A2 share House A; B1 is in House B; SOLO has no household. The security claims:
 *   • a member sees their household's shared list — even one they didn't create (pure household_id RLS),
 *   • a member CANNOT read or write another household's list/items,
 *   • a user with NO household is unaffected — sees only their own list, never a household's,
 *   • both members of A converge on the SAME shared list via getOrCreateActiveList.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  createDb,
  getActiveListView,
  getOrCreateActiveList,
  canonicalItems,
  households,
  shoppingListItems,
  shoppingLists,
  unitsOfMeasure,
  users,
  withTenant,
} from "@gm/db";

const ADMIN_URL = process.env.RLS_TEST_ADMIN_URL;
const APP_URL = process.env.RLS_TEST_DATABASE_URL;
const run = ADMIN_URL && APP_URL ? describe : describe.skip;

run("cross-household RLS isolation (shared shopping list)", () => {
  const admin = createDb(ADMIN_URL!);
  const app = createDb(APP_URL!);

  let userA1 = "";
  let userA2 = "";
  let userB1 = "";
  let userSolo = "";
  let houseA = "";
  let houseB = "";
  let listA = "";
  let listB = "";
  let listSolo = "";
  let itemId = "";

  beforeAll(async () => {
    // Force the feature ON so the household-aware query helpers resolve to the shared list.
    process.env.FEATURE_HOUSEHOLDS = "1";

    const stamp = Date.now();
    const mk = async (email: string) => {
      const [u] = await admin.db
        .insert(users)
        .values({ email: `${email}-${stamp}@test.local` })
        .returning({ id: users.id });
      return u!.id;
    };
    userA1 = await mk("hh-a1");
    userA2 = await mk("hh-a2");
    userB1 = await mk("hh-b1");
    userSolo = await mk("hh-solo");

    const [hA] = await admin.db
      .insert(households)
      .values({ name: "House A", ownerUserId: userA1 })
      .returning({ id: households.id });
    const [hB] = await admin.db
      .insert(households)
      .values({ name: "House B", ownerUserId: userB1 })
      .returning({ id: households.id });
    houseA = hA!.id;
    houseB = hB!.id;

    // Membership pointers (admin: RLS-bypassed).
    await admin.db.execute(
      sql`update users set household_id = ${houseA} where id in (${userA1}, ${userA2})`,
    );
    await admin.db.execute(sql`update users set household_id = ${houseB} where id = ${userB1}`);

    // A shared catalog item to put on each list (catalog has no RLS).
    const [unit] = await admin.db
      .insert(unitsOfMeasure)
      .values({ code: `each-${stamp}`, name: "each", dimension: "COUNT", toBaseFactor: "1" })
      .returning({ id: unitsOfMeasure.id });
    const [item] = await admin.db
      .insert(canonicalItems)
      .values({ name: "Milk", slug: `milk-${stamp}`, baseUnitId: unit!.id })
      .returning({ id: canonicalItems.id });
    itemId = item!.id;

    // House A's shared list (owned by A1, shared via household_id), House B's, and SOLO's per-user list.
    const [lA] = await admin.db
      .insert(shoppingLists)
      .values({ userId: userA1, householdId: houseA, name: "List A" })
      .returning({ id: shoppingLists.id });
    const [lB] = await admin.db
      .insert(shoppingLists)
      .values({ userId: userB1, householdId: houseB, name: "List B" })
      .returning({ id: shoppingLists.id });
    const [lSolo] = await admin.db
      .insert(shoppingLists)
      .values({ userId: userSolo, name: "Solo List" })
      .returning({ id: shoppingLists.id });
    listA = lA!.id;
    listB = lB!.id;
    listSolo = lSolo!.id;

    await admin.db.insert(shoppingListItems).values([
      { shoppingListId: listA, canonicalItemId: itemId },
      { shoppingListId: listB, canonicalItemId: itemId },
      { shoppingListId: listSolo, canonicalItemId: itemId },
    ]);
  });

  afterAll(async () => {
    // Delete in FK-safe order on the admin connection. (lists.household_id / users.household_id are
    // ON DELETE SET NULL, so clear households after detaching members + lists.)
    for (const id of [userA1, userA2, userB1, userSolo]) {
      if (id) await admin.db.execute(sql`update users set household_id = null where id = ${id}`);
    }
    for (const id of [houseA, houseB]) {
      if (id) await admin.db.delete(households).where(sql`id = ${id}`);
    }
    for (const id of [userA1, userA2, userB1, userSolo]) {
      if (id) await admin.db.delete(users).where(sql`id = ${id}`);
    }
    if (itemId) await admin.db.delete(canonicalItems).where(sql`id = ${itemId}`);
    await admin.client.end();
    await app.client.end();
  });

  it("a member sees their household's shared list — even one they didn't create", async () => {
    // A2 did NOT create List A (A1 did); A2 reaches it purely via the household_id RLS branch.
    const view = await withTenant(app.db, userA2, (tx) => getActiveListView(tx, userA2));
    expect(view.length).toBe(1);
    expect(view[0]!.name).toBe("Milk");

    const lists = (await withTenant(app.db, userA2, (tx) =>
      tx.execute(sql`select name from shopping_lists order by name`),
    )) as unknown as { name: string }[];
    expect(lists.map((r) => r.name)).toEqual(["List A"]);
  });

  it("a member CANNOT read another household's list or items", async () => {
    // B1's list/items are invisible to A2 — even when asking by id.
    const items = (await withTenant(app.db, userA2, (tx) =>
      tx.execute(
        sql`select count(*)::int as n from shopping_list_items where shopping_list_id = ${listB}`,
      ),
    )) as unknown as { n: number }[];
    expect(items[0]!.n).toBe(0);

    const houses = (await withTenant(app.db, userA2, (tx) =>
      tx.execute(sql`select name from households order by name`),
    )) as unknown as { name: string }[];
    expect(houses.map((r) => r.name)).toEqual(["House A"]);
  });

  it("a member CANNOT write into another household's list (WITH CHECK)", async () => {
    await expect(
      withTenant(app.db, userA2, (tx) =>
        tx.execute(
          sql`insert into shopping_list_items (shopping_list_id, canonical_item_id) values (${listB}, ${itemId})`,
        ),
      ),
    ).rejects.toThrow();
  });

  // --- Regression: the cross-household WRITE bypass via the `user_id = me` branch (must stay closed) ---
  // Before the policy was split into command-specific rules, a member could "plant" a list stamped with
  // ANOTHER household's id (the INSERT passed WITH CHECK via `user_id = me`), making it appear in that
  // household's shared view — a direct cross-tenant write. These two assert the hole is shut.

  it("a member CANNOT plant a list stamped with another household's id (INSERT bypass)", async () => {
    await expect(
      withTenant(app.db, userA2, (tx) =>
        tx.execute(
          sql`insert into shopping_lists (user_id, household_id, name, status, generated_by, retailer)
              values (${userA2}, ${houseB}, 'PLANTED', 'active', 'manual', 'instacart')`,
        ),
      ),
    ).rejects.toThrow();
  });

  it("a member CANNOT move their own list into another household (UPDATE bypass)", async () => {
    // A2 owns a fresh solo list (user_id = A2, household_id = NULL); try to relocate it into House B.
    const [own] = await admin.db
      .insert(shoppingLists)
      .values({ userId: userA2, name: "A2 solo" })
      .returning({ id: shoppingLists.id });
    await expect(
      withTenant(app.db, userA2, (tx) =>
        tx.execute(sql`update shopping_lists set household_id = ${houseB} where id = ${own!.id}`),
      ),
    ).rejects.toThrow();
    await admin.db.delete(shoppingLists).where(sql`id = ${own!.id}`);
  });

  it("a non-owner member CANNOT delete the household (DELETE is owner-only)", async () => {
    // A2 is a member but not the owner of House A. DELETE under RLS affects 0 rows (no error), so we
    // assert the household survives rather than expecting a throw.
    await withTenant(app.db, userA2, (tx) =>
      tx.execute(sql`delete from households where id = ${houseA}`),
    );
    const still = (await admin.db.execute(
      sql`select count(*)::int as n from households where id = ${houseA}`,
    )) as unknown as { n: number }[];
    expect(still[0]!.n).toBe(1);
  });

  it("a member CAN write into their own household's shared list", async () => {
    const before = await withTenant(app.db, userA2, (tx) => getActiveListView(tx, userA2));
    await withTenant(app.db, userA2, (tx) =>
      tx.execute(
        sql`insert into shopping_list_items (shopping_list_id, canonical_item_id) values (${listA}, ${itemId})`,
      ),
    );
    const after = await withTenant(app.db, userA2, (tx) => getActiveListView(tx, userA2));
    expect(after.length).toBe(before.length + 1);
  });

  it("a user with NO household is unaffected — sees only their own list, never a household's", async () => {
    const view = await withTenant(app.db, userSolo, (tx) => getActiveListView(tx, userSolo));
    expect(view.length).toBe(1); // their own Solo List item

    const lists = (await withTenant(app.db, userSolo, (tx) =>
      tx.execute(sql`select name from shopping_lists order by name`),
    )) as unknown as { name: string }[];
    expect(lists.map((r) => r.name)).toEqual(["Solo List"]);

    // And cannot write into household A's list.
    await expect(
      withTenant(app.db, userSolo, (tx) =>
        tx.execute(
          sql`insert into shopping_list_items (shopping_list_id, canonical_item_id) values (${listA}, ${itemId})`,
        ),
      ),
    ).rejects.toThrow();
  });

  it("getOrCreateActiveList resolves to the SAME shared list for both members", async () => {
    const idForA1 = await withTenant(app.db, userA1, (tx) => getOrCreateActiveList(tx, userA1));
    const idForA2 = await withTenant(app.db, userA2, (tx) => getOrCreateActiveList(tx, userA2));
    expect(idForA1).toBe(listA);
    expect(idForA2).toBe(listA); // both members converge on the household's list
  });
});
