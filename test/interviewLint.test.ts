import { describe, it, expect } from "vitest";
import { lintSolutionSource, firstFindingPerLine } from "../src/modules/InterviewLint";

describe("InterviewLint", () => {
  it("flags mutating calls on parameters (python)", () => {
    const src = [
      "class Solution:",
      "    def twoSum(self, nums, target):",
      "        nums.sort()",
      "        return nums",
    ].join("\n");
    const findings = lintSolutionSource(src, "python");
    const mutate = findings.find((f) => f.rule === "mutate-input");
    expect(mutate, "should flag nums.sort()").toBeTruthy();
    expect(mutate?.line).toBe(2);
    expect(mutate?.message ?? "").toMatch(/nums/);
  });

  it("flags mutating calls on parameters (typescript)", () => {
    const src = [
      "function twoSum(nums: number[], target: number): number[] {",
      "  nums.push(target);",
      "  return nums;",
      "}",
    ].join("\n");
    const findings = lintSolutionSource(src, "typescript");
    const mutate = findings.find((f) => f.rule === "mutate-input");
    expect(mutate, "should flag nums.push()").toBeTruthy();
    expect(mutate?.severity).toBe("warning");
  });

  it("flags builtin sort even on non-param arrays", () => {
    const src = [
      "function solve(items: number[]): number[] {",
      "  const copy = items.slice();",
      "  copy.sort();",
      "  return copy;",
      "}",
    ].join("\n");
    const findings = lintSolutionSource(src, "typescript");
    const builtin = findings.find((f) => f.rule === "builtin-sort");
    expect(builtin, "should flag copy.sort()").toBeTruthy();
  });

  it("flags magic numbers but skips const declarations", () => {
    const src = [
      "function solve(s: string): number {",
      "  const ALPHABET = 26;",
      "  const freq = new Array(26).fill(0);",
      "  return 26;",
      "}",
    ].join("\n");
    const findings = lintSolutionSource(src, "typescript");
    const magics = findings.filter((f) => f.rule === "magic-number");
    // Lines: 2 (Array(26).fill), 3 (return 26) — NOT line 1 (const ALPHABET = 26).
    const lines = magics.map((m) => m.line);
    expect(lines.sort()).toEqual([2, 3]);
  });

  it("flags indented debug prints without expected comment", () => {
    const src = [
      "class Solution:",
      "    def solve(self, n):",
      "        print('debug', n)",
      "        return n",
      "",
      "print(Solution().solve(5))  # expected: 5",
    ].join("\n");
    const findings = lintSolutionSource(src, "python");
    const debugs = findings.filter((f) => f.rule === "debug-print");
    expect(debugs.length).toBe(1);
    expect(debugs[0].line).toBe(2);
  });

  it("respects // lcex-lint-ignore per-rule suppression", () => {
    const src = [
      "function twoSum(nums: number[], target: number): number[] {",
      "  nums.sort();  // lcex-lint-ignore: mutate-input",
      "  return nums;",
      "}",
    ].join("\n");
    const findings = lintSolutionSource(src, "typescript");
    expect(findings.find((f) => f.rule === "mutate-input")).toBe(undefined);
    // builtin-sort is NOT suppressed, should still fire.
    expect(findings.find((f) => f.rule === "builtin-sort")).toBeTruthy();
  });

  it("respects // lcex-lint-ignore: all", () => {
    const src = [
      "function solve(nums: number[]): number {",
      "  nums.sort();  // lcex-lint-ignore: all",
      "  return 26;",
      "}",
    ].join("\n");
    const findings = lintSolutionSource(src, "typescript");
    const onLine1 = findings.filter((f) => f.line === 1);
    expect(onLine1.length).toBe(0);
  });

  it("firstFindingPerLine dedupes by line", () => {
    const src = [
      "function solve(nums: number[]): number[] {",
      "  nums.sort();",  // mutate-input + builtin-sort both on this line
      "  return nums;",
      "}",
    ].join("\n");
    const all = lintSolutionSource(src, "typescript");
    expect(all.length >= 2, "expected at least 2 findings on mutating-sort line").toBeTruthy();
    const dedup = firstFindingPerLine(all);
    const line1 = dedup.filter((f) => f.line === 1);
    expect(line1.length).toBe(1);
  });

  it("ignores code inside string literals", () => {
    const src = [
      "function solve(nums: number[]): string {",
      "  return 'nums.sort()';",
      "}",
    ].join("\n");
    const findings = lintSolutionSource(src, "typescript");
    expect(findings.length).toBe(0);
  });
});
