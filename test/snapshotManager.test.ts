import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { captureSnapshot, getSnapshots, getLatestSnapshot, finalizeProblemRating } from "../src/modules/SnapshotManager";
import { readState, writeState, initState } from "../src/modules/StateManager";
import { recordHintAccess, getHintAccessCount } from "../src/modules/HintFile";
import type { LPState } from "../src/modules/interface/LPState";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-snapshot-"));
}

describe("SnapshotManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should capture snapshot, write file, and update state", async () => {
    const problems = [
      {
        id: 1,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays",
        status: "pending" as const,
        scheduledDate: new Date().toISOString(),
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Two Pointers"],
        leetcodeUrl: null,
        youtubeId: null,
        solutionLink: null,
        hints: null,
        solution: null,
      },
    ];
    await initState(tmpDir, "NeetCode 150", problems);

    const solutionFile = path.join(tmpDir, "1.two-sum.ts");
    fs.writeFileSync(solutionFile, "function twoSum(nums: number[]): number[] { return []; }", "utf-8");

    recordHintAccess("two-sum");
    recordHintAccess("two-sum");
    expect(getHintAccessCount("two-sum")).toBe(2);

    const snap = await captureSnapshot(
      tmpDir, 1, "two-sum", solutionFile, 2, "Used a map approach", 2, "AI matched Good"
    );

    expect(snap).toBeTruthy();
    expect(snap.rating).toBe(2);
    expect(snap.notes).toBe("Used a map approach");
    expect(snap.hintsUsed).toBe(2);
    expect(getHintAccessCount("two-sum")).toBe(0);

    const snapshotBaseDir = path.join(tmpDir, ".leetplus", "snapshots", "two-sum");
    expect(fs.existsSync(snapshotBaseDir)).toBeTruthy();
    const files = fs.readdirSync(snapshotBaseDir);
    expect(files.length).toBe(1);
    expect(files[0].endsWith(".ts")).toBeTruthy();

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();
    expect(state.problems[0].status).toBe("completed");
    expect(state.problems[0].repetitionLevel).toBe(1);
    expect(state.problems[0].nextRepetitionDate).toBeTruthy();
    expect(state.problems[0].completionHistory.length).toBe(1);
    expect(state.problems[0].completionHistory[0].notes).toBe("Used a map approach");
    expect(state.currentStreak).toBe(1);

    const snaps = await getSnapshots(tmpDir, 1, "two-sum");
    expect(snaps.length).toBe(1);
    expect(snaps[0].notes).toBe("Used a map approach");

    const latest = await getLatestSnapshot(tmpDir, 1, "two-sum");
    expect(latest).toBeTruthy();
    expect(latest.notes).toBe("Used a map approach");
  });

  describe("diffRetention strategies", () => {
    const setupProblemWorkspace = async (dir: string) => {
      const problems = [
        {
          id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
          category: "Arrays", status: "pending" as const,
          scheduledDate: new Date().toISOString(), nextRepetitionDate: null,
          repetitionLevel: 0, completionHistory: [], patterns: [],
        },
      ];
      await initState(dir, "NeetCode 150", problems);

      const solutionFile = path.join(dir, "1.two-sum.ts");
      fs.writeFileSync(solutionFile, "function twoSum() {}", "utf-8");

      const diffsDir = path.join(dir, ".leetplus", "diffs", "two-sum");
      fs.mkdirSync(diffsDir, { recursive: true });
      fs.writeFileSync(path.join(diffsDir, "test.patch"), "mock patch diff content", "utf-8");

      return { solutionFile, diffsDir };
    };

    it("should handle 'session' retention: copy patch to snapshots and remove diffs directory", async () => {
      const { solutionFile, diffsDir } = await setupProblemWorkspace(tmpDir);
      const leetplusDir = path.join(tmpDir, ".leetplus");
      fs.writeFileSync(path.join(leetplusDir, "config.json"), JSON.stringify({ diffRetention: "session" }), "utf-8");

      await captureSnapshot(tmpDir, 1, "two-sum", solutionFile, 2, "notes");

      const snapshotsDir = path.join(leetplusDir, "snapshots", "two-sum");
      const snapshotFiles = fs.readdirSync(snapshotsDir);
      expect(snapshotFiles.includes("test.patch")).toBeTruthy();
      expect(fs.existsSync(diffsDir)).toBe(false);
    });

    it("should handle 'all' retention: copy patch to snapshots and retain diffs directory", async () => {
      const { solutionFile, diffsDir } = await setupProblemWorkspace(tmpDir);
      const leetplusDir = path.join(tmpDir, ".leetplus");
      fs.writeFileSync(path.join(leetplusDir, "config.json"), JSON.stringify({ diffRetention: "all" }), "utf-8");

      await captureSnapshot(tmpDir, 1, "two-sum", solutionFile, 2, "notes");

      const snapshotsDir = path.join(leetplusDir, "snapshots", "two-sum");
      const snapshotFiles = fs.readdirSync(snapshotsDir);
      expect(snapshotFiles.includes("test.patch")).toBeTruthy();
      expect(fs.existsSync(diffsDir)).toBe(true);
      expect(fs.existsSync(path.join(diffsDir, "test.patch"))).toBe(true);
    });

    it("should handle 'none' retention: remove diffs directory without copying", async () => {
      const { solutionFile, diffsDir } = await setupProblemWorkspace(tmpDir);
      const leetplusDir = path.join(tmpDir, ".leetplus");
      fs.writeFileSync(path.join(leetplusDir, "config.json"), JSON.stringify({ diffRetention: "none" }), "utf-8");

      await captureSnapshot(tmpDir, 1, "two-sum", solutionFile, 2, "notes");

      const snapshotsDir = path.join(leetplusDir, "snapshots", "two-sum");
      const snapshotFiles = fs.readdirSync(snapshotsDir);
      expect(snapshotFiles.includes("test.patch")).toBe(false);
      expect(fs.existsSync(diffsDir)).toBe(false);
    });
  });

  describe("finalizeProblemRating", () => {
    it("should correctly update placeholder rating, re-calculate SRS, and set final notes/justification", async () => {
      const problems = [
        {
          id: 42, title: "Trapping Rain Water", slug: "trapping-rain-water",
          difficulty: "Hard", category: "Two Pointers", status: "pending" as const,
          scheduledDate: new Date().toISOString(), nextRepetitionDate: null,
          repetitionLevel: 0, completionHistory: [], patterns: ["Two Pointers"],
        },
      ];
      await initState(tmpDir, "NeetCode 150", problems);

      const solutionFile = path.join(tmpDir, "42.trapping-rain-water.ts");
      fs.writeFileSync(solutionFile, "function trap() {}", "utf-8");

      await captureSnapshot(tmpDir, 42, "trapping-rain-water", solutionFile, 2, "initial placeholder");

      let state = await readState(tmpDir);
      expect(state?.problems[0].completionHistory[0].rating).toBe(2);
      expect(state?.problems[0].repetitionLevel).toBe(1);

      const nextDate = await finalizeProblemRating(
        tmpDir, "trapping-rain-water", 3, "actually it was quite hard and tricky",
        3, "Used a lot of space and double pointer loops."
      );

      expect(nextDate).toBeTruthy();
      state = await readState(tmpDir);
      const problem = state?.problems[0];
      expect(problem).toBeTruthy();
      expect(problem.status).toBe("completed");
      expect(problem.repetitionLevel).toBe(0);
      expect(problem.completionHistory.length).toBe(1);

      const snap = problem.completionHistory[0];
      expect(snap.rating).toBe(3);
      expect(snap.notes).toBe("actually it was quite hard and tricky");
      expect(snap.aiRating).toBe(3);
      expect(snap.aiJustification).toBe("Used a lot of space and double pointer loops.");
    });
  });
});
