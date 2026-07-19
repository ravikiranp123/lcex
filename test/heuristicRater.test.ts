import { describe, it, expect } from "vitest";
import { estimateRating } from "../src/modules/HeuristicRater";

const ROOT = "/tmp/test";
const SLUG = "two-sum";

const SIMPLE_DESC = `<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p><p><strong>Constraints:</strong></p><ul><li><code>2 &lt;= nums.length &lt;= 10<sup>5</sup></code></li></ul>`;

const NESTED_DESC = `<p>Given an array, find all pairs that sum to target.</p><p><strong>Constraints:</strong></p><ul><li><code>1 &lt;= nums.length &lt;= 10<sup>5</sup></code></li></ul>`;

const LINEAR_SOLUTION = `function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement)!, i];
    map.set(nums[i], i);
  }
  return [];
}`;

const NESTED_SOLUTION = `function twoSum(nums: number[], target: number): number[] {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}`;

describe("HeuristicRater (4a.3)", () => {
  it("returns correct shape", async () => {
    const result = await estimateRating(ROOT, SLUG, LINEAR_SOLUTION, "typescript", SIMPLE_DESC);

    expect(result).toHaveProperty("rating");
    expect(result).toHaveProperty("justification");
    expect(result).toHaveProperty("source");
    expect(result).toHaveProperty("patternsDetected");
    expect(result.source).toBe("heuristic");
    expect(typeof result.rating).toBe("number");
    expect(result.rating).toBeGreaterThanOrEqual(0);
    expect(result.rating).toBeLessThanOrEqual(4);
    expect(Array.isArray(result.patternsDetected)).toBeTruthy();
  });

  it("empty placeholder code → rating 4", async () => {
    const result = await estimateRating(ROOT, SLUG, "pass", "typescript", SIMPLE_DESC);
    expect(result.rating).toBe(4);
  });

  it("solution within complexity budget → rating 1 or 2", async () => {
    const result = await estimateRating(ROOT, SLUG, LINEAR_SOLUTION, "typescript", SIMPLE_DESC);
    expect(result.rating).toBeLessThanOrEqual(2);
  });

  it("solution exceeds complexity budget → rating 3", async () => {
    const result = await estimateRating(ROOT, SLUG, NESTED_SOLUTION, "typescript", NESTED_DESC);
    expect(result.rating).toBe(3);
  });

  it("0 hints: no penalty applied", async () => {
    const result = await estimateRating(ROOT, SLUG, LINEAR_SOLUTION, "typescript", SIMPLE_DESC, 0);
    expect(result.rating).toBeLessThanOrEqual(2);
    expect(result.justification).not.toContain("hint");
  });

  it("1-2 hints: mild penalty bumps rating up", async () => {
    const resultNoHints = await estimateRating(ROOT, SLUG, LINEAR_SOLUTION, "typescript", SIMPLE_DESC, 0);
    const resultTwoHints = await estimateRating(ROOT, SLUG, LINEAR_SOLUTION, "typescript", SIMPLE_DESC, 2);
    expect(resultTwoHints.rating).toBeGreaterThanOrEqual(resultNoHints.rating);
  });

  it("3+ hints: rating capped to at least 2", async () => {
    const result = await estimateRating(ROOT, SLUG, LINEAR_SOLUTION, "typescript", SIMPLE_DESC, 5);
    expect(result.rating).toBeGreaterThanOrEqual(2);
  });
});
