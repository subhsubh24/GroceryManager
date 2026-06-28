import { describe, it, expect } from "vitest";
import { buildAnnualNudgeEmail, buildWinbackEmail } from "./emails.js";

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

describe("html safety", () => {
  it("escapes a name with angle brackets / ampersands in the rendered html", () => {
    const e = buildAnnualNudgeEmail({ ...base, name: "<b>&Co" });
    expect(e.html).not.toContain("<b>&Co");
    expect(e.html).toContain("&lt;b&gt;&amp;Co");
  });
});
