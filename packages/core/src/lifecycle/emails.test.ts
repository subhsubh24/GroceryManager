import { describe, it, expect } from "vitest";
import {
  buildAnnualNudgeEmail,
  buildWinbackEmail,
  buildTrialWelcomeEmail,
  buildTrialReminderEmail,
  buildTrialExpiryEmail,
} from "./emails.js";

const base = {
  appUrl: "https://grocerymanager.app",
  unsubscribeUrl: "https://grocerymanager.app/api/email/unsubscribe?email=a%40b.com&token=deadbeef",
};

describe("buildAnnualNudgeEmail (H14)", () => {
  it("greets by name when present and generically when absent", () => {
    expect(buildAnnualNudgeEmail({ ...base, name: "Sam" }).text).toContain("Hi Sam,");
    expect(buildAnnualNudgeEmail({ ...base, name: null }).text).toContain("Hi there,");
    expect(buildAnnualNudgeEmail({ ...base, name: "  " }).text).toContain("Hi there,");
  });

  it("uses the real annual price + per-month + savings (matches billing config)", () => {
    const e = buildAnnualNudgeEmail({ ...base, name: "Sam" });
    expect(e.text).toContain("$39.99/year");
    expect(e.text).toContain("$3.33/month");
    expect(e.text).toContain("$20"); // 4.99*12 - 39.99 = 19.89 ≈ 20
  });

  it("CTA points at manage-subscription (where the plan switch happens) in both html + text", () => {
    const e = buildAnnualNudgeEmail({ ...base, name: null });
    expect(e.html).toContain("https://grocerymanager.app/manage-subscription");
    expect(e.text).toContain("https://grocerymanager.app/manage-subscription");
  });

  it("savings variant leads with the dollar figure; control uses the routine framing", () => {
    const savings = buildAnnualNudgeEmail({ ...base, name: null, variant: "savings" });
    const control = buildAnnualNudgeEmail({ ...base, name: null, variant: "control" });
    expect(savings.subject).toContain("Save");
    expect(savings.subject).not.toEqual(control.subject);
  });

  it("always includes the unsubscribe link (raw in text, &-escaped in html)", () => {
    const e = buildAnnualNudgeEmail({ ...base, name: null });
    expect(e.text).toContain(base.unsubscribeUrl);
    // In HTML the & must be escaped to &amp; inside the href attribute.
    expect(e.html).toContain("/api/email/unsubscribe?email=a%40b.com&amp;token=deadbeef");
  });
});

describe("buildWinbackEmail (H15)", () => {
  it("greets and includes the free-features-stay reassurance (honest, no false promise)", () => {
    const e = buildWinbackEmail({ ...base, name: "Lee" });
    expect(e.text).toContain("Hi Lee,");
    expect(e.text.toLowerCase()).toContain("free");
  });

  it("does NOT promise a discount/coupon (none is wired into checkout)", () => {
    for (const variant of [undefined, "control", "value"]) {
      const e = buildWinbackEmail({ ...base, name: null, variant });
      const blob = `${e.subject} ${e.text} ${e.html}`.toLowerCase();
      expect(blob).not.toContain("discount");
      expect(blob).not.toContain("coupon");
      expect(blob).not.toContain("% off");
      expect(blob).not.toContain("promo");
    }
  });

  it("CTA points at /upgrade and includes the unsubscribe link", () => {
    const e = buildWinbackEmail({ ...base, name: null });
    expect(e.html).toContain("https://grocerymanager.app/upgrade");
    expect(e.text).toContain(base.unsubscribeUrl);
  });

  it("value variant differs from control in subject", () => {
    const value = buildWinbackEmail({ ...base, name: null, variant: "value" });
    const control = buildWinbackEmail({ ...base, name: null, variant: "control" });
    expect(value.subject).not.toEqual(control.subject);
  });
});

describe("buildTrialWelcomeEmail (H16 / T1)", () => {
  it("greets by name when present and generically when absent", () => {
    expect(buildTrialWelcomeEmail({ ...base, name: "Sam" }).text).toContain("Hi Sam,");
    expect(buildTrialWelcomeEmail({ ...base, name: null }).text).toContain("Hi there,");
  });

  it("states the 7-day / $4.99-mo / $39.99-yr / cancel-anytime terms plainly", () => {
    const e = buildTrialWelcomeEmail({ ...base, name: "Sam" });
    expect(e.text).toContain("7 days");
    expect(e.text).toContain("$4.99/month");
    expect(e.text).toContain("$39.99/year");
    expect(e.text.toLowerCase()).toContain("cancel anytime");
  });

  it("lists the unlocked Premium features", () => {
    const t = buildTrialWelcomeEmail({ ...base, name: null }).text.toLowerCase();
    expect(t).toContain("gmail");
    expect(t).toContain("planner");
    expect(t).toContain("discover");
    expect(t).toContain("remix");
  });

  it("CTA points at the real Gmail-connect surface (/pantry) in both html + text", () => {
    const e = buildTrialWelcomeEmail({ ...base, name: null });
    expect(e.html).toContain("https://grocerymanager.app/pantry");
    expect(e.text).toContain("https://grocerymanager.app/pantry");
  });

  it("always includes the unsubscribe link (raw in text, &-escaped in html)", () => {
    const e = buildTrialWelcomeEmail({ ...base, name: null });
    expect(e.text).toContain(base.unsubscribeUrl);
    expect(e.html).toContain("/api/email/unsubscribe?email=a%40b.com&amp;token=deadbeef");
  });

  it("accuracy: never says 'buy'/'purchase' (the trial auto-converts, nothing to buy)", () => {
    const blob = Object.values(buildTrialWelcomeEmail({ ...base, name: null }))
      .join(" ")
      .toLowerCase();
    expect(blob).not.toContain("buy");
    expect(blob).not.toContain("purchase");
    expect(blob).not.toContain("discount");
    expect(blob).not.toContain("coupon");
  });
});

describe("buildTrialReminderEmail (H17 / T2)", () => {
  it("greets by name / generically", () => {
    expect(buildTrialReminderEmail({ ...base, name: "Lee" }).text).toContain("Hi Lee,");
    expect(buildTrialReminderEmail({ ...base, name: null }).text).toContain("Hi there,");
  });

  it("is transparent that the subscription begins at $4.99/mo and cancel is possible", () => {
    for (const variant of [undefined, "control", "urgency"]) {
      const e = buildTrialReminderEmail({ ...base, name: null, variant });
      expect(e.text).toContain("$4.99/month");
      expect(e.text.toLowerCase()).toContain("begins");
      expect(e.text.toLowerCase()).toContain("cancel");
    }
  });

  it("CTA points at manage-subscription (already subscribed — never /upgrade)", () => {
    const e = buildTrialReminderEmail({ ...base, name: null });
    expect(e.html).toContain("https://grocerymanager.app/manage-subscription");
    expect(e.text).toContain("https://grocerymanager.app/manage-subscription");
    expect(e.html).not.toContain("/upgrade");
  });

  it("urgency variant changes framing vs control", () => {
    const urgency = buildTrialReminderEmail({ ...base, name: null, variant: "urgency" });
    const control = buildTrialReminderEmail({ ...base, name: null, variant: "control" });
    expect(urgency.subject).not.toEqual(control.subject);
  });

  it("always includes the unsubscribe link (raw in text, &-escaped in html)", () => {
    const e = buildTrialReminderEmail({ ...base, name: null });
    expect(e.text).toContain(base.unsubscribeUrl);
    expect(e.html).toContain("/api/email/unsubscribe?email=a%40b.com&amp;token=deadbeef");
  });

  it("accuracy: transparency, not 'buy to keep' — no buy/purchase/discount/coupon", () => {
    for (const variant of [undefined, "control", "urgency"]) {
      const blob = Object.values(buildTrialReminderEmail({ ...base, name: null, variant }))
        .join(" ")
        .toLowerCase();
      expect(blob).not.toContain("buy");
      expect(blob).not.toContain("purchase");
      expect(blob).not.toContain("discount");
      expect(blob).not.toContain("coupon");
    }
  });
});

describe("buildTrialExpiryEmail (H18 / T3)", () => {
  it("greets by name / generically", () => {
    expect(buildTrialExpiryEmail({ ...base, name: "Ada" }).text).toContain("Hi Ada,");
    expect(buildTrialExpiryEmail({ ...base, name: null }).text).toContain("Hi there,");
  });

  it("says the trial ends today and Premium begins, and offers the annual saving", () => {
    for (const variant of [undefined, "control", "annual"]) {
      const e = buildTrialExpiryEmail({ ...base, name: null, variant });
      expect(e.text.toLowerCase()).toContain("ends today");
      expect(e.text.toLowerCase()).toContain("begins");
      // Real annual price + per-month + savings (the only allowed, real saving — not a coupon).
      expect(e.text).toContain("$39.99/year");
      expect(e.text).toContain("$3.33/month");
      expect(e.text).toContain("$20");
      expect(e.text.toLowerCase()).toContain("cancel");
    }
  });

  it("CTA points at manage-subscription (already subscribed — never /upgrade)", () => {
    const e = buildTrialExpiryEmail({ ...base, name: null });
    expect(e.html).toContain("https://grocerymanager.app/manage-subscription");
    expect(e.text).toContain("https://grocerymanager.app/manage-subscription");
    expect(e.html).not.toContain("/upgrade");
  });

  it("annual variant changes framing vs control", () => {
    const annual = buildTrialExpiryEmail({ ...base, name: null, variant: "annual" });
    const control = buildTrialExpiryEmail({ ...base, name: null, variant: "control" });
    expect(annual.subject).not.toEqual(control.subject);
  });

  it("always includes the unsubscribe link (raw in text, &-escaped in html)", () => {
    const e = buildTrialExpiryEmail({ ...base, name: null });
    expect(e.text).toContain(base.unsubscribeUrl);
    expect(e.html).toContain("/api/email/unsubscribe?email=a%40b.com&amp;token=deadbeef");
  });

  it("accuracy: real annual saving only — no fake discount/coupon/'buy to keep'", () => {
    for (const variant of [undefined, "control", "annual"]) {
      const blob = Object.values(buildTrialExpiryEmail({ ...base, name: null, variant }))
        .join(" ")
        .toLowerCase();
      expect(blob).not.toContain("buy");
      expect(blob).not.toContain("purchase");
      expect(blob).not.toContain("discount");
      expect(blob).not.toContain("coupon");
      expect(blob).not.toContain("% off");
      expect(blob).not.toContain("promo");
    }
  });
});

describe("html safety", () => {
  it("escapes a name with angle brackets / ampersands in the rendered html", () => {
    const e = buildAnnualNudgeEmail({ ...base, name: "<b>&Co" });
    expect(e.html).not.toContain("<b>&Co");
    expect(e.html).toContain("&lt;b&gt;&amp;Co");
  });
});
