import { describe, expect, it } from "vitest";
import { promoCodePrompts } from "@/lib/workflows/prompts/promo-code-analysis";

describe("Promo Code Analysis prompt", () => {
  it("does not invent profit or causal acquisition verdicts", () => {
    const prompt = promoCodePrompts.analyze;

    expect(prompt).toContain("descriptive campaign evidence");
    expect(prompt).not.toContain("43%");
    expect(prompt).not.toContain("$35.23");
    expect(prompt).not.toContain("profitable");
    expect(prompt).not.toContain("CPA target");
  });
});
