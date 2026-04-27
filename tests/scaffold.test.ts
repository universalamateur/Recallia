import { describe, expect, it } from "vitest";

describe("Recallia scaffold", () => {
  it("keeps the baseline test runner wired", () => {
    expect("Recallia").toContain("Recall");
  });
});
