import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordSolveForPatterns,
  computeMastery,
  summarizePatternMastery,
  pickWeakestPattern,
  resetPatternMastery,
  PATTERN_MASTERY_KEY,
  type PatternMasteryEntry,
} from "../src/modules/PatternMastery";

function createMemento(store: Record<string, unknown> = {}) {
  return {
    get: <T>(key: string) => store[key] as T | undefined,
    update: async (key: string, value: unknown) => { store[key] = value; },
    keys: async () => Object.keys(store),
  } as any;
}

describe("PatternMastery", () => {
  let memento: ReturnType<typeof createMemento>;

  beforeEach(() => {
    memento = createMemento();
  });

  describe("recordSolveForPatterns", () => {
    it("first solve for a pattern → credits pattern, count=1", async () => {
      const result = await recordSolveForPatterns(memento, "two-sum", ["twoPointers"]);
      expect(result.creditedPatterns).toEqual(["twoPointers"]);
      expect(result.newPatterns).toEqual(["twoPointers"]);
      const state = memento.get(PATTERN_MASTERY_KEY) as any;
      expect(state.byPattern.twoPointers.solvedCount).toBe(1);
      expect(state.byPattern.twoPointers.slugsSolved).toEqual(["two-sum"]);
    });

    it("same slug solved again → count NOT incremented (idempotent per-slug)", async () => {
      await recordSolveForPatterns(memento, "two-sum", ["twoPointers"]);
      const result = await recordSolveForPatterns(memento, "two-sum", ["twoPointers"]);
      expect(result.newPatterns).toEqual([]);
      const state = memento.get(PATTERN_MASTERY_KEY) as any;
      expect(state.byPattern.twoPointers.solvedCount).toBe(1);
      expect(state.byPattern.twoPointers.slugsSolved).toEqual(["two-sum"]);
    });

    it("different slug same pattern → count incremented", async () => {
      await recordSolveForPatterns(memento, "two-sum", ["twoPointers"]);
      const result = await recordSolveForPatterns(memento, "three-sum", ["twoPointers"]);
      expect(result.newPatterns).toEqual(["twoPointers"]);
      const state = memento.get(PATTERN_MASTERY_KEY) as any;
      expect(state.byPattern.twoPointers.solvedCount).toBe(2);
      expect(state.byPattern.twoPointers.slugsSolved).toEqual(["two-sum", "three-sum"]);
    });

    it("empty patterns array → early return, no state written", async () => {
      const result = await recordSolveForPatterns(memento, "two-sum", []);
      expect(result.creditedPatterns).toEqual([]);
      expect(result.newPatterns).toEqual([]);
      expect(memento.get(PATTERN_MASTERY_KEY)).toBeUndefined();
    });
  });

  describe("computeMastery", () => {
    it("solvedCount=0 → returns 0", () => {
      const entry: PatternMasteryEntry = {
        patternId: "twoPointers",
        solvedCount: 0,
        slugsSolved: [],
        totalConfidence: 0,
      };
      expect(computeMastery(entry)).toBe(0);
    });

    it("recent solve (day=0) → no decay, value close to (1-1/(1+count))*0.5^0", () => {
      const now = new Date("2026-07-19T12:00:00.000Z");
      const entry: PatternMasteryEntry = {
        patternId: "twoPointers",
        solvedCount: 3,
        slugsSolved: ["a"],
        totalConfidence: 3,
        lastSolvedAt: now.toISOString(),
      };
      const mastery = computeMastery(entry, now);
      const expectedRaw = 1 - 1 / (1 + 3); // 0.75
      expect(mastery).toBeCloseTo(expectedRaw, 5);
    });

    it("old solve (day=21) → value halved (half-life=21 days)", () => {
      const now = new Date("2026-07-19T12:00:00.000Z");
      const lastSolved = new Date("2026-06-28T12:00:00.000Z"); // 21 days ago
      const entry: PatternMasteryEntry = {
        patternId: "twoPointers",
        solvedCount: 3,
        slugsSolved: ["a"],
        totalConfidence: 3,
        lastSolvedAt: lastSolved.toISOString(),
      };
      const mastery = computeMastery(entry, now);
      const expectedRaw = 1 - 1 / (1 + 3); // 0.75
      expect(mastery).toBeCloseTo(expectedRaw * 0.5, 5);
    });
  });

  describe("summarizePatternMastery", () => {
    it("pattern with 0 solves → rank untouched", async () => {
      const summary = summarizePatternMastery(memento);
      const twoPointers = summary.find(s => s.patternId === "twoPointers");
      expect(twoPointers).toBeTruthy();
      expect(twoPointers!.rank).toBe("untouched");
      expect(twoPointers!.solvedCount).toBe(0);
    });

    it("pattern with mastery < 0.2 → rank rusty", async () => {
      const now = new Date("2026-07-19T12:00:00.000Z");
      const lastSolved = new Date("2026-05-01T12:00:00.000Z"); // long ago → heavy decay
      await recordSolveForPatterns(memento, "a", ["twoPointers"], lastSolved);
      const summary = summarizePatternMastery(memento, now);
      const tp = summary.find(s => s.patternId === "twoPointers");
      expect(tp!.rank).toBe("rusty");
    });
  });

  describe("pickWeakestPattern", () => {
    it("returns untouched pattern first when one exists", async () => {
      await recordSolveForPatterns(memento, "a", ["twoPointers"]);
      const weakest = pickWeakestPattern(memento);
      expect(weakest).toBeTruthy();
      expect(weakest!.rank).toBe("untouched");
    });

    it("empty state → returns an untouched pattern (not undefined)", () => {
      const weakest = pickWeakestPattern(memento);
      expect(weakest).toBeDefined();
      expect(weakest!.rank).toBe("untouched");
    });
  });
});
