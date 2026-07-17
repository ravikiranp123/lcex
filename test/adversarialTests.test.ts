import { describe, it, expect } from "vitest";
import {
  buildAdversarialSummary,
  findSignatureLine,
} from "../src/modules/AdversarialTests";

const TWO_SUM_HTML = `
<p>Given an array of integers <code>nums</code>...</p>
<p><strong>Constraints:</strong></p>
<ul>
  <li><code>2 &lt;= nums.length &lt;= 10^4</code></li>
  <li><code>-10^9 &lt;= nums[i] &lt;= 10^9</code></li>
  <li><code>-10^9 &lt;= target &lt;= 10^9</code></li>
</ul>
<p><strong>Example 1:</strong></p>
`;

describe("AdversarialTests", () => {
  it("surfaces max-size, boundaries, and negative hints for Two Sum shape", () => {
    const s = buildAdversarialSummary(TWO_SUM_HTML);
    expect(s.perCase.length >= 3, `expected multiple cases, got ${s.perCase.length}`).toBeTruthy();
    const labels = s.perCase.map((c) => c.label).join(" | ");
    expect(labels).toMatch(/size=/);
    expect(labels).toMatch(/negative|at int bounds/i);
    expect(s.signatureLine.startsWith("  ⚠"), "signature line should warn").toBeTruthy();
  });

  it("renders 10^k sizes with superscript instead of '104'", () => {
    const html = `
<p><strong>Constraints:</strong></p>
<ul>
  <li><code>1 &lt;= nums.length &lt;= 10<sup>4</sup></code></li>
</ul>
<p><strong>Example 1:</strong></p>
`;
    const s = buildAdversarialSummary(html);
    const labels = s.perCase.map((c) => c.label).join(" | ");
    expect(labels).toMatch(/10⁴/);
    expect(labels).not.toMatch(/size=104\b/);
  });

  it("falls back cleanly when no constraints section exists", () => {
    const s = buildAdversarialSummary("<p>Just a description with no constraints.</p>");
    expect(s.perCase.length).toBe(0);
    expect(s.signatureLine).toMatch(/no structured constraints/i);
  });

  it("finds the def line for Python solutions", () => {
    const src = [
      "from typing import List",
      "",
      "class Solution:",
      "    def twoSum(self, nums: List[int], target: int) -> List[int]:",
      "        return []",
    ].join("\n");
    const line = findSignatureLine(src, "python");
    expect(line).toBe(2);
  });

  it("finds the function line for TypeScript solutions", () => {
    const src = [
      "// comment",
      "function twoSum(nums: number[], target: number): number[] {",
      "  return [];",
      "}",
    ].join("\n");
    const line = findSignatureLine(src, "typescript");
    expect(line).toBe(1);
  });
});
