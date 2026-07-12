import { describe, expect, it } from "vitest";
import { isUniqueViolation, UNIQUE_VIOLATION } from "./pg-error";

describe("isUniqueViolation", () => {
  it("matches a postgres.js unique_violation (SQLSTATE 23505)", () => {
    // Shape of a real `postgres` PostgresError (only the fields we inspect).
    const err = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      constraint_name: "users_username_unique",
    });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("matches a plain object carrying the code (wrapped/re-thrown error)", () => {
    expect(isUniqueViolation({ code: UNIQUE_VIOLATION })).toBe(true);
  });

  it("does NOT match other SQLSTATE codes (e.g. 23503 foreign_key_violation)", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(Object.assign(new Error("fk"), { code: "23502" }))).toBe(false);
  });

  it("does NOT match errors without a code (generic Error, string, number)", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(23505)).toBe(false);
  });

  it("does NOT match null / undefined (never throws on non-objects)", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it("does NOT match a numeric code that only coerces to 23505", () => {
    // Strict equality: a numeric 23505 is not the string SQLSTATE.
    expect(isUniqueViolation({ code: 23505 })).toBe(false);
  });
});
