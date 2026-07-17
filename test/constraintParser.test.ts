import { describe, it, expect } from "vitest";
import { parseProblemConstraints } from "../src/modules/ConstraintParser";

describe("ConstraintParser", () => {
  it("parses numeric bounds including 10^k notation", () => {
    const text = `
Given an array of integers.

Constraints:
1 <= nums.length <= 10^5
-10^9 <= nums[i] <= 10^9
0 <= k <= 100
`;
    const c = parseProblemConstraints(text);
    expect(c.byName.get("nums.length")?.min).toBe(1);
    expect(c.byName.get("nums.length")?.max).toBe(100000);
    expect(c.byName.get("nums[i]")?.min).toBe(-1_000_000_000);
    expect(c.byName.get("nums[i]")?.max).toBe(1_000_000_000);
    expect(c.byName.get("k")?.max).toBe(100);
  });

  it("parses HTML-wrapped constraints with &le; and &lt;= entities", () => {
    const html = `
<p>Blah.</p>
<p><strong>Constraints:</strong></p>
<ul>
  <li><code>1 &lt;= s.length &lt;= 10^5</code></li>
  <li><code>s</code> consists of only lowercase English letters.</li>
</ul>
<p><strong>Example 1:</strong></p>
`;
    const c = parseProblemConstraints(html);
    const s = c.byName.get("s.length");
    expect(s?.min).toBe(1);
    expect(s?.max).toBe(100000);
    expect(c.byName.get("s")?.charset).toBe("lowercase");
  });

  it("detects sorted / distinct flags", () => {
    const text = `
Constraints:
1 <= nums.length <= 50
nums is sorted in non-decreasing order.
All the integers of nums are unique.
`;
    const c = parseProblemConstraints(text);
    expect(c.byName.get("nums")?.sorted).toBe("asc");
    expect(c.byName.get("nums")?.distinct).toBe(true);
  });

  it("handles LeetCode's <sup>N</sup> exponent markup", () => {
    const html = `
<p>Blah.</p>
<p><strong>Constraints:</strong></p>
<ul>
  <li><code>1 &lt;= nums.length &lt;= 10<sup>4</sup></code></li>
  <li><code>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></code></li>
</ul>
<p><strong>Example 1:</strong></p>
`;
    const c = parseProblemConstraints(html);
    expect(c.byName.get("nums.length")?.max).toBe(10000);
    expect(c.byName.get("nums[i]")?.min).toBe(-1_000_000_000);
    expect(c.byName.get("nums[i]")?.max).toBe(1_000_000_000);
  });

  it("stops at Example / Follow-up section", () => {
    const text = `
Constraints:
1 <= n <= 10
Follow-up: can you solve in O(1) space?
2 <= m <= 20
`;
    const c = parseProblemConstraints(text);
    expect(c.byName.has("n")).toBe(true);
    expect(c.byName.has("m")).toBe(false);
  });
});
