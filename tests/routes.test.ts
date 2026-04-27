import { describe, expect, it } from "vitest";
import { safeInternalPath } from "../src/lib/routes";

describe("safeInternalPath", () => {
  it("allows single-slash internal paths", () => {
    expect(safeInternalPath("/timeline")).toBe("/timeline");
    expect(safeInternalPath("/timeline?draft=1")).toBe("/timeline?draft=1");
  });

  it("falls back for unsafe login next values", () => {
    expect(safeInternalPath(null)).toBe("/timeline");
    expect(safeInternalPath("https://example.com")).toBe("/timeline");
    expect(safeInternalPath("//example.com")).toBe("/timeline");
  });
});
