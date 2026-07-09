/**
 * One-off owner script: mint gated-beta INVITE CODES (§34 Part B) for waitlisted people.
 *
 *   DATABASE_URL=… DIRECT_DATABASE_URL=… pnpm --filter @gm/workers invite:issue [count]
 *
 * Issues a code to the next `count` CONFIRMED (double-opt-in) waitlist emails that don't have one
 * yet (default 25), oldest-confirmed first, and prints an `email → CODE` table the owner sends out
 * (email delivery is Track H / owner-connected — this script only mints, so the loop never sends on
 * the owner's behalf). Idempotent per email: re-running never re-issues to someone already invited,
 * and a specific email can be invited with `--email you@example.com`.
 *
 * Uses the admin (owner) connection so it can write the admin-only waitlist table. Codes are
 * high-entropy (@gm/core generator) and unique; issuance retries on the astronomically unlikely
 * collision internally.
 */
import { randomBytes } from "node:crypto";
import {
  getAdminDb,
  getWaitlistInviteStats,
  issueWaitlistInvite,
  listUnissuedConfirmedEmails,
} from "@gm/db";
import {
  formatInviteCodeForDisplay,
  generateInviteCode,
} from "@gm/core/security/invite-code";

function parseArgs(argv: string[]): { count: number; email: string | null } {
  let count = 25;
  let email: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--email") email = argv[++i] ?? null;
    else if (/^\d+$/.test(a)) count = parseInt(a, 10);
  }
  return { count: Math.max(1, Math.min(count, 1000)), email };
}

async function main() {
  const db = getAdminDb();
  const gen = () => generateInviteCode((n) => randomBytes(n));
  const { count, email } = parseArgs(process.argv.slice(2));

  const targets = email ? [email] : await listUnissuedConfirmedEmails(db, count);
  if (targets.length === 0) {
    console.log("→ No confirmed, un-invited waitlist emails to issue codes to. Nothing to do.");
    return;
  }

  console.log(`→ Issuing invite codes to ${targets.length} email(s)…\n`);
  let issued = 0;
  for (const addr of targets) {
    const code = await issueWaitlistInvite(db, addr, gen);
    if (!code) {
      console.log(`  (skip) ${addr} — not on the waitlist`);
      continue;
    }
    issued++;
    console.log(`  ${addr.padEnd(40)}  ${formatInviteCodeForDisplay(code)}`);
  }
  console.log(
    `\n✓ ${issued} code(s) ready. Send each person their code (or a /join?code=<CODE> link). ` +
      `Redeeming it lets them past the site gate to /signup.`,
  );

  // Beta roll-out at a glance: total codes issued vs redeemed so far (the cohort funnel).
  const stats = await getWaitlistInviteStats(db);
  console.log(`\n  Beta invites — issued: ${stats.issued} · redeemed: ${stats.redeemed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
