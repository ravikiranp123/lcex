import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

vi.mock("vscode", () => ({ default: {}, workspace: { workspaceFolders: undefined } }), { virtual: true });

describe("BugReviewStore", () => {
  let tmpDir: string;
  let readBugReviews: typeof import("../src/modules/BugReviewStore").readBugReviews;
  let recordFailure: typeof import("../src/modules/BugReviewStore").recordFailure;
  let listDueReviews: typeof import("../src/modules/BugReviewStore").listDueReviews;
  let advanceOnPass: typeof import("../src/modules/BugReviewStore").advanceOnPass;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lcex-bugreview-"));

    vi.resetModules();

    vi.doMock("../src/modules/LeetPlusInterviewReportStore", () => ({
      LCEX_HOME_DIR: tmpDir,
      atomicWriteJsonSync: (absPath: string, data: unknown) => {
        const target = path.join(tmpDir, path.basename(absPath));
        fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf-8");
      },
      ensureLcexDir: () => {},
    }));

    const mod = await import("../src/modules/BugReviewStore");
    readBugReviews = mod.readBugReviews;
    recordFailure = mod.recordFailure;
    listDueReviews = mod.listDueReviews;
    advanceOnPass = mod.advanceOnPass;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleInput = {
    titleSlug: "two-sum",
    problemTitle: "Two Sum",
    language: "typescript" as const,
    source: "examples" as const,
    input: "[1,2,3]",
    expected: "[0,1]",
    actual: "[]",
    sourceSnippet: "const result = [];",
    fullSource: "function twoSum(nums: number[], target: number): number[] { return []; }",
  };

  it("should add a review entry and surface it when nextDueAt is past", () => {
    const review = recordFailure(sampleInput);
    expect(review.id).toContain("two-sum");
    expect(review.intervalDays).toBe(3);

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const due = listDueReviews(futureDate);
    expect(due.length).toBeGreaterThanOrEqual(1);
    expect(due.some((r) => r.id === review.id)).toBe(true);
  });

  it("should not return entries with future nextDueAt", () => {
    recordFailure(sampleInput);

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const due = listDueReviews(futureDate);
    expect(due.length).toBe(0);
  });

  it("should advance interval from 3 to 7 on first pass", () => {
    const review = recordFailure(sampleInput);
    expect(review.intervalDays).toBe(3);

    const advanced = advanceOnPass(review.id);
    expect(advanced).toBeDefined();
    expect(advanced!.intervalDays).toBe(7);
  });

  it("should return undefined for unknown id on advanceOnPass", () => {
    const result = advanceOnPass("nonexistent-id");
    expect(result).toBeUndefined();
  });

  it("should return empty store for corrupted file", () => {
    const corruptPath = path.join(tmpDir, "bug-reviews.json");
    fs.writeFileSync(corruptPath, "{ bad json {{{", "utf-8");

    const store = readBugReviews();
    expect(store.version).toBe(1);
    expect(store.reviews).toEqual([]);
  });
});
