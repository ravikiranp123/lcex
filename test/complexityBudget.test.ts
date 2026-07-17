import { describe, it, expect } from "vitest";
import { parseProblemConstraints } from "../src/modules/ConstraintParser";
import {
  deriveBudget,
  estimateLoopNesting,
  compareToBudget,
  buildComplexityInlineItems,
} from "../src/modules/ComplexityBudget";

describe("ComplexityBudget", () => {
  it("derives target O(n log n) for n ≤ 10^5", () => {
    const c = parseProblemConstraints(`
Constraints:
1 <= nums.length <= 10^5
`);
    const b = deriveBudget(c);
    expect(b).toBeTruthy();
    expect(b!.maxSize).toBe(100000);
    expect(b!.targetDepth).toBe(1);
    expect(b!.targetLabel).toMatch(/log n/);
  });

  it("derives O(n²) budget for n ≤ 1000", () => {
    const c = parseProblemConstraints(`
Constraints:
1 <= n <= 1000
`);
    const b = deriveBudget(c);
    expect(b).toBeTruthy();
    expect(b!.targetDepth).toBe(2);
  });

  it("allows O(2^n) for tiny n ≤ 20", () => {
    const c = parseProblemConstraints(`
Constraints:
1 <= n <= 20
`);
    const b = deriveBudget(c);
    expect(b).toBeTruthy();
    expect(b!.targetDepth).toBe(99);
  });

  it("estimates nested-loop depth via indentation (python)", () => {
    const src = [
      "class Solution:",
      "    def solve(self, nums):",
      "        for i in range(len(nums)):",
      "            for j in range(i+1, len(nums)):",
      "                if nums[i] == nums[j]:",
      "                    return True",
      "        return False",
    ].join("\n");
    const est = estimateLoopNesting(src, "python");
    expect(est.maxDepth).toBe(2);
    expect(est.loops.length).toBe(2);
  });

  it("estimates depth 3 for triple-nested (typescript)", () => {
    const src = [
      "function solve(nums: number[][]): number {",
      "  for (let i = 0; i < nums.length; i++) {",
      "    for (let j = 0; j < nums.length; j++) {",
      "      for (let k = 0; k < nums.length; k++) {",
      "        if (nums[i][j] === k) return 1;",
      "      }",
      "    }",
      "  }",
      "  return 0;",
      "}",
    ].join("\n");
    const est = estimateLoopNesting(src, "typescript");
    expect(est.maxDepth).toBe(3);
  });

  it("flags over-budget: O(n²) with n ≤ 10^5", () => {
    const c = parseProblemConstraints(`
Constraints:
1 <= nums.length <= 10^5
`);
    const b = deriveBudget(c);
    const est = estimateLoopNesting(
      "class Solution:\n    def f(self, nums):\n        for i in nums:\n            for j in nums:\n                pass",
      "python"
    );
    const v = compareToBudget(est, b);
    expect(v.tone).toBe("over");
    expect(v.icon).toBe("🔴");
  });

  it("marks within-budget: O(n) with n ≤ 10^5", () => {
    const c = parseProblemConstraints(`
Constraints:
1 <= nums.length <= 10^5
`);
    const b = deriveBudget(c);
    const est = estimateLoopNesting(
      "function f(nums: number[]) { for (let i = 0; i < nums.length; i++) { nums[i]++; } }",
      "typescript"
    );
    const v = compareToBudget(est, b);
    expect(v.tone).toBe("ok");
    expect(v.icon).toBe("🟢");
  });

  it("detects hasSort and upgrades O(n) estimate to O(n log n)", () => {
    const src = [
      "function f(nums: number[]) {",
      "  nums.sort();",
      "  for (const x of nums) { console.log(x); }",
      "}",
    ].join("\n");
    const est = estimateLoopNesting(src, "typescript");
    expect(est.hasSort).toBe(true);
  });

  it("builds inline items tagged with correct severities", () => {
    const c = parseProblemConstraints(`
Constraints:
1 <= nums.length <= 10^5
`);
    const b = deriveBudget(c);
    const est = estimateLoopNesting(
      "function f(nums: number[]) {\n  for (let i = 0; i < n; i++) {\n    for (let j = 0; j < n; j++) {\n      nums[i]++;\n    }\n  }\n}",
      "typescript"
    );
    const items = buildComplexityInlineItems(0, est, b);
    expect(items[0].severity).toBe("error");
    const inner = items.find((i) => i.line === 2);
    expect(inner).toBeTruthy();
    expect(inner!.severity).toBe("error");
  });

  it("returns null budget when constraints have no size cap", () => {
    const c = parseProblemConstraints(`
Constraints:
Answer fits in a 32-bit integer.
`);
    const b = deriveBudget(c);
    expect(b).toBe(null);
  });
});

/**
 * Pattern-catalog tests for the structured analyzer. These guard the cases
 * the indent-only estimator got wrong: constant-bounded inner loops,
 * log-shrinkage loops, two-pointer / sliding-window / monotonic-stack
 * amortized patterns, call-catalog upgrades (heappush, Array.includes), and
 * recursion (Master theorem + DFS-with-visited).
 */
describe("ComplexityEngine — loop bounds", () => {
  it("constant-bounded inner loop (range(26)) → O(n), not O(n²)", () => {
    const src = [
      "class Solution:",
      "    def f(self, s):",
      "        for i in range(len(s)):",
      "            for c in range(26):",
      "                pass",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.maxDepth).toBe(1);
    expect(e.bigO).toMatch(/^O\(n\)$/);
    expect(e.confidence).not.toBe("low");
  });

  it("logarithmic inner loop (x //= 2) inside linear outer → O(n log n)", () => {
    const src = [
      "def f(nums):",
      "    for i in range(len(nums)):",
      "        x = nums[i]",
      "        while x > 0:",
      "            x //= 2",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toBe("O(n log n)");
    expect(e.maxDepth).toBe(1);
    expect(e.hasLogFactor).toBe(true);
  });

  it("sqrt loop (i*i <= n) → O(√n)", () => {
    const src = [
      "function f(n: number) {",
      "  for (let i = 1; i * i <= n; i++) {",
      "    if (n % i === 0) return i;",
      "  }",
      "  return -1;",
      "}",
    ].join("\n");
    const e = estimateLoopNesting(src, "typescript");
    expect(e.bigO).toMatch(/√n|sqrt/i);
    expect(e.maxDepth).toBe(0);
  });
});

describe("ComplexityEngine — amortized", () => {
  it("two-pointer while → O(n), not O(n²)", () => {
    const src = [
      "def twoSum(nums, target):",
      "    l, r = 0, len(nums) - 1",
      "    while l < r:",
      "        s = nums[l] + nums[r]",
      "        if s == target: return [l, r]",
      "        if s < target: l += 1",
      "        else: r -= 1",
      "    return []",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toBe("O(n)");
    expect(e.maxDepth).toBe(1);
  });

  it("sliding window (for outer + while-advance inner) → O(n)", () => {
    const src = [
      "def lengthOfLongestSubstring(s):",
      "    seen = {}",
      "    l = 0",
      "    best = 0",
      "    for r in range(len(s)):",
      "        while s[r] in seen and seen[s[r]] >= l:",
      "            l += 1",
      "        seen[s[r]] = r",
      "        if r - l + 1 > best: best = r - l + 1",
      "    return best",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toBe("O(n)");
    expect(e.maxDepth).toBe(1);
  });

  it("monotonic stack (while stack and ...: stack.pop()) inside for → O(n)", () => {
    const src = [
      "def dailyTemperatures(t):",
      "    stack = []",
      "    res = [0] * len(t)",
      "    for i in range(len(t)):",
      "        while stack and t[stack[-1]] < t[i]:",
      "            j = stack.pop()",
      "            res[j] = i - j",
      "        stack.append(i)",
      "    return res",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toBe("O(n)");
    expect(e.maxDepth).toBe(1);
  });
});

describe("ComplexityEngine — call catalog", () => {
  it("heappush in a loop → O(n log n)", () => {
    const src = [
      "import heapq",
      "def f(nums):",
      "    h = []",
      "    for x in nums:",
      "        heapq.heappush(h, x)",
      "    return h",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toBe("O(n log n)");
    expect(e.maxDepth).toBe(1);
    expect(e.hasLogFactor).toBe(true);
  });

  it("Array.includes in a loop → O(n²)", () => {
    const src = [
      "function f(nums: number[], q: number[]): number[] {",
      "  const out: number[] = [];",
      "  for (const x of q) {",
      "    if (nums.includes(x)) out.push(x);",
      "  }",
      "  return out;",
      "}",
    ].join("\n");
    const e = estimateLoopNesting(src, "typescript");
    expect(e.bigO).toBe("O(n²)");
    expect(e.maxDepth).toBe(2);
  });

  it("sort + single pass → O(n log n)", () => {
    const src = [
      "function f(nums: number[]) {",
      "  nums.sort();",
      "  for (const x of nums) { console.log(x); }",
      "}",
    ].join("\n");
    const e = estimateLoopNesting(src, "typescript");
    expect(e.bigO).toBe("O(n log n)");
  });
});

describe("ComplexityEngine — recursion", () => {
  it("mergesort 2T(n/2) + O(n) → O(n log n)", () => {
    const src = [
      "def mergeSort(arr):",
      "    if len(arr) <= 1: return arr",
      "    mid = len(arr) // 2",
      "    left = mergeSort(arr[:mid])",
      "    right = mergeSort(arr[mid:])",
      "    out = []",
      "    i, j = 0, 0",
      "    while i < len(left) and j < len(right):",
      "        if left[i] <= right[j]:",
      "            out.append(left[i]); i += 1",
      "        else:",
      "            out.append(right[j]); j += 1",
      "    return out + left[i:] + right[j:]",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toBe("O(n log n)");
  });

  it("linear recursion T(n-1) + O(1) → O(n)", () => {
    const src = [
      "def fact(n):",
      "    if n <= 1: return 1",
      "    return n * fact(n - 1)",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toBe("O(n)");
  });

  it("two recursive calls without halving → exponential", () => {
    const src = [
      "def fib(n):",
      "    if n <= 1: return n",
      "    return fib(n - 1) + fib(n - 2)",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toMatch(/2ⁿ|exp/i);
  });

  it("DFS over adjacency list with visited → O(V+E)", () => {
    const src = [
      "def dfs(u, adj, visited):",
      "    if u in visited: return",
      "    visited.add(u)",
      "    for v in adj[u]:",
      "        dfs(v, adj, visited)",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.bigO).toMatch(/V\+E/);
  });
});

describe("ComplexityEngine — confidence", () => {
  it("returns low confidence (severity capped to 🟡) when nested loop bound is unrecognized", () => {
    const src = [
      "def f(g):",
      "    while not g.done():",
      "        while not g.subDone():",
      "            g.step()",
    ].join("\n");
    const e = estimateLoopNesting(src, "python");
    expect(e.confidence).toBe("low");

    const c = parseProblemConstraints(`Constraints:\n1 <= n <= 10^5\n`);
    const b = deriveBudget(c);
    const v = compareToBudget(e, b);
    // Even though depth-2 unknowns mean overall could be O(n²), severity must NOT escalate to 🔴.
    expect(v.icon).not.toBe("🔴");
  });

  it("empty body → O(1) with high confidence", () => {
    const src = "function f() { return 1; }";
    const e = estimateLoopNesting(src, "typescript");
    expect(e.maxDepth).toBe(0);
    expect(e.confidence).toBe("high");
  });
});

describe("ComplexityEngine — multi-language two-pointer", () => {
  it("two-pointer in TypeScript → O(n)", () => {
    const src = [
      "function twoSum(nums: number[], target: number): number[] {",
      "  let l = 0, r = nums.length - 1;",
      "  while (l < r) {",
      "    const s = nums[l] + nums[r];",
      "    if (s === target) return [l, r];",
      "    if (s < target) l++;",
      "    else r--;",
      "  }",
      "  return [];",
      "}",
    ].join("\n");
    const e = estimateLoopNesting(src, "typescript");
    expect(e.bigO).toBe("O(n)");
  });

  it("two-pointer in C++ → O(n)", () => {
    const src = [
      "vector<int> twoSum(vector<int>& nums, int target) {",
      "  int l = 0, r = nums.size() - 1;",
      "  while (l < r) {",
      "    int s = nums[l] + nums[r];",
      "    if (s == target) return {l, r};",
      "    if (s < target) l++;",
      "    else r--;",
      "  }",
      "  return {};",
      "}",
    ].join("\n");
    const e = estimateLoopNesting(src, "cpp");
    expect(e.bigO).toBe("O(n)");
  });
});
