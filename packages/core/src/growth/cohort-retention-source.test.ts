/**
 * H11 — tests for the cohort-retention DATA SOURCE (@gm/db/queries/cohort-retention).
 *
 * The aggregate SQL itself needs a live Postgres, so these tests cover what's testable purely:
 *  - the pure row-shaping transform (`shapeCohortRows`),
 *  - `getCohortRetention`'s graceful handling of an empty result and of a pre-migration
 *    "relation does not exist" error (→ null), via a mocked Querier.
 *
 * These also lock the emitted aggregate to the exact `RawCohortRow` shape that
 * `buildCohortRetention` (this package) consumes — feeding one through the other end-to-end.
 */
import { describe, expect, it } from "vitest";
import {
  getCohortRetention,
  shapeCohortRows,
  type CohortSqlRow,
} from "@gm/db";
import { buildCohortRetention } from "./analytics.js";

/** Minimal Querier stub: only `execute` is exercised by getCohortRetention. */
function mockDb(execute: () => Promise<unknown>) {
  return { execute } as unknown as Parameters<typeof getCohortRetention>[0];
}

describe("shapeCohortRows", () => {
  it("coerces text cohort_size and normalizes the int[] retained_counts", () => {
    const rows: CohortSqlRow[] = [
      { cohort_week: "2026-06-01", cohort_size: "30", retained_counts: [30, 18, 12, null, 0, 0, 0, 0] },
    ];
    expect(shapeCohortRows(rows)).toEqual([
      { cohort_week: "2026-06-01", cohort_size: 30, retained_counts: [30, 18, 12, 0, 0, 0, 0, 0] },
    ]);
  });

  it("handles a null/absent retained_counts array", () => {
    const rows: CohortSqlRow[] = [
      { cohort_week: "2026-06-08", cohort_size: "5", retained_counts: null },
    ];
    expect(shapeCohortRows(rows)).toEqual([
      { cohort_week: "2026-06-08", cohort_size: 5, retained_counts: [] },
    ]);
  });

  it("returns [] for no rows", () => {
    expect(shapeCohortRows([])).toEqual([]);
  });
});

describe("getCohortRetention", () => {
  it("returns [] (honest empty, not null) when the query yields no cohorts", async () => {
    const db = mockDb(async () => []);
    await expect(getCohortRetention(db)).resolves.toEqual([]);
  });

  it("returns null when the source tables are absent (pre-migration)", async () => {
    const db = mockDb(async () => {
      throw new Error('relation "meal_logs" does not exist');
    });
    await expect(getCohortRetention(db)).resolves.toBeNull();
  });

  it("re-throws unexpected (non pre-migration) errors", async () => {
    const db = mockDb(async () => {
      throw new Error("connection terminated unexpectedly");
    });
    await expect(getCohortRetention(db)).rejects.toThrow("connection terminated");
  });

  it("feeds cleanly into the buildCohortRetention SURFACE builder", async () => {
    const db = mockDb(async () => [
      { cohort_week: "2026-06-01", cohort_size: "40", retained_counts: [40, 30, 20, 10, 5, 2, 1, 0] },
      { cohort_week: "2026-06-08", cohort_size: "10", retained_counts: [10, 5, 2, 0, 0, 0, 0, 0] },
    ]);
    const rows = await getCohortRetention(db);
    expect(rows).not.toBeNull();

    const surface = buildCohortRetention({ connected: rows !== null, rows });
    expect(surface).not.toBeNull();
    // Cohort 0 (size 40 ≥ threshold) → real fractions; cohort 1 (size 10 < 20) → low_sample, null rates.
    expect(surface![0]!.retention_by_week[0]).toBe(1); // week 0 = 40/40
    expect(surface![0]!.retention_by_week[1]).toBe(0.75); // 30/40
    expect(surface![0]!.low_sample).toBe(false);
    expect(surface![1]!.low_sample).toBe(true);
    expect(surface![1]!.retention_by_week.every((v) => v === null)).toBe(true);
  });
});
