

import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { captureSnapshot, getSnapshots, getLatestSnapshot, finalizeProblemRating } from "../src/modules/SnapshotManager";
import { readState, writeState, initState } from "../src/modules/StateManager";
import { recordHintAccess, getHintAccessCount } from "../src/modules/HintFile";
import type { LPState } from "../src/modules/interface/LPState";

const TEST_DIR = path.join(__dirname, "..", "test-snapshot-output");

describe("SnapshotManager", () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should capture snapshot, write file, and update state", async () => {
    const workspaceRoot = path.join(TEST_DIR, "workspace1");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    // 1. Initialize State
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
    await initState(workspaceRoot, "NeetCode 150", problems);

    // 2. Create a mock solution file
    const solutionFile = path.join(workspaceRoot, "1.two-sum.ts");
    fs.writeFileSync(solutionFile, "function twoSum(nums: number[]): number[] { return []; }", "utf-8");

    // 3. Record hint accesses in memory
    recordHintAccess("two-sum");
    recordHintAccess("two-sum");
    expect(getHintAccessCount("two-sum")).toBe(2);

    // 4. Run captureSnapshot
    const snap = await captureSnapshot(
      workspaceRoot,
      1,
      "two-sum",
      solutionFile,
      2, // Good rating
      "Used a map approach",
      2,
      "AI matched Good"
    );

    // 5. Verifications
    expect(snap).toBeTruthy();
    expect(snap.rating).toBe(2);
    expect(snap.notes).toBe("Used a map approach");
    expect(snap.hintsUsed).toBe(2);
    
    // Verifying HintCount reset
    expect(getHintAccessCount("two-sum")).toBe(0);

    // Verify snapshot file creation
    const snapshotBaseDir = path.join(workspaceRoot, ".leetplus", "snapshots", "two-sum");
    expect(fs.existsSync(snapshotBaseDir)).toBeTruthy();
    
    const files = fs.readdirSync(snapshotBaseDir);
    expect(files.length).toBe(1);
    expect(files[0].endsWith(".ts")).toBeTruthy();

    // Verify state updating
    const state = await readState(workspaceRoot);
    expect(state).toBeTruthy();
    expect(state.problems[0].status).toBe("completed");
    expect(state.problems[0].repetitionLevel).toBe(1);
    expect(state.problems[0].nextRepetitionDate).toBeTruthy();
    expect(state.problems[0].completionHistory.length).toBe(1);
    expect(state.problems[0].completionHistory[0].notes).toBe("Used a map approach");
    expect(state.currentStreak).toBe(1);

    // Verify snapshot getters
    const snaps = await getSnapshots(workspaceRoot, 1, "two-sum");
    expect(snaps.length).toBe(1);
    expect(snaps[0].notes).toBe("Used a map approach");

    const latest = await getLatestSnapshot(workspaceRoot, 1, "two-sum");
    expect(latest).toBeTruthy();
    expect(latest.notes).toBe("Used a map approach");
  });

  describe("diffRetention strategies", () => {
    const setupProblemWorkspace = async (workspaceRoot: string) => {
      fs.mkdirSync(workspaceRoot, { recursive: true });
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
          patterns: [],
        },
      ];
      await initState(workspaceRoot, "NeetCode 150", problems);

      const solutionFile = path.join(workspaceRoot, "1.two-sum.ts");
      fs.writeFileSync(solutionFile, "function twoSum() {}", "utf-8");

      // Set up a mock diff patch file
      const diffsDir = path.join(workspaceRoot, ".leetplus", "diffs", "two-sum");
      fs.mkdirSync(diffsDir, { recursive: true });
      fs.writeFileSync(path.join(diffsDir, "test.patch"), "mock patch diff content", "utf-8");

      return { solutionFile, diffsDir };
    };

    it("should handle 'session' retention: copy patch to snapshots and remove diffs directory", async () => {
      const workspaceRoot = path.join(TEST_DIR, "retention-session");
      const { solutionFile, diffsDir } = await setupProblemWorkspace(workspaceRoot);

      // Write config.json specifying retention
      const leetplusDir = path.join(workspaceRoot, ".leetplus");
      fs.writeFileSync(
        path.join(leetplusDir, "config.json"),
        JSON.stringify({ diffRetention: "session" }),
        "utf-8"
      );

      await captureSnapshot(workspaceRoot, 1, "two-sum", solutionFile, 2, "notes");

      // Verify patch is in snapshots
      const snapshotsDir = path.join(leetplusDir, "snapshots", "two-sum");
      const snapshotFiles = fs.readdirSync(snapshotsDir);
      expect(snapshotFiles.includes("test.patch")).toBeTruthy();

      // Verify diffs/1/ is deleted
      expect(fs.existsSync(diffsDir)).toBe(false);
    });

    it("should handle 'all' retention: copy patch to snapshots and retain diffs directory", async () => {
      const workspaceRoot = path.join(TEST_DIR, "retention-all");
      const { solutionFile, diffsDir } = await setupProblemWorkspace(workspaceRoot);

      const leetplusDir = path.join(workspaceRoot, ".leetplus");
      fs.writeFileSync(
        path.join(leetplusDir, "config.json"),
        JSON.stringify({ diffRetention: "all" }),
        "utf-8"
      );

      await captureSnapshot(workspaceRoot, 1, "two-sum", solutionFile, 2, "notes");

      // Verify patch is in snapshots
      const snapshotsDir = path.join(leetplusDir, "snapshots", "two-sum");
      const snapshotFiles = fs.readdirSync(snapshotsDir);
      expect(snapshotFiles.includes("test.patch")).toBeTruthy();

      // Verify diffs/1/ is retained
      expect(fs.existsSync(diffsDir)).toBe(true);
      expect(fs.existsSync(path.join(diffsDir, "test.patch"))).toBe(true);
    });

    it("should handle 'none' retention: remove diffs directory without copying", async () => {
      const workspaceRoot = path.join(TEST_DIR, "retention-none");
      const { solutionFile, diffsDir } = await setupProblemWorkspace(workspaceRoot);

      const leetplusDir = path.join(workspaceRoot, ".leetplus");
      fs.writeFileSync(
        path.join(leetplusDir, "config.json"),
        JSON.stringify({ diffRetention: "none" }),
        "utf-8"
      );

      await captureSnapshot(workspaceRoot, 1, "two-sum", solutionFile, 2, "notes");

      // Verify patch is NOT in snapshots
      const snapshotsDir = path.join(leetplusDir, "snapshots", "two-sum");
      const snapshotFiles = fs.readdirSync(snapshotsDir);
      expect(snapshotFiles.includes("test.patch")).toBe(false);

      // Verify diffs/1/ is deleted
      expect(fs.existsSync(diffsDir)).toBe(false);
    });
  });

  describe("finalizeProblemRating", () => {
    it("should correctly update placeholder rating, re-calculate SRS, and set final notes/justification", async () => {
      const workspaceRoot = path.join(TEST_DIR, "workspace-finalize");
      fs.mkdirSync(workspaceRoot, { recursive: true });

      const problems = [
        {
          id: 42,
          title: "Trapping Rain Water",
          slug: "trapping-rain-water",
          difficulty: "Hard",
          category: "Two Pointers",
          status: "pending" as const,
          scheduledDate: new Date().toISOString(),
          nextRepetitionDate: null,
          repetitionLevel: 0,
          completionHistory: [],
          patterns: ["Two Pointers"],
        },
      ];
      await initState(workspaceRoot, "NeetCode 150", problems);

      const solutionFile = path.join(workspaceRoot, "42.trapping-rain-water.ts");
      fs.writeFileSync(solutionFile, "function trap() {}", "utf-8");

      // Stage 1 snapshot capture
      await captureSnapshot(workspaceRoot, 42, "trapping-rain-water", solutionFile, 2, "initial placeholder");

      // Verify intermediate status
      let state = await readState(workspaceRoot);
      expect(state?.problems[0].completionHistory[0].rating).toBe(2);
      expect(state?.problems[0].repetitionLevel).toBe(1);

      // Finalize rating to 'Hard' (3)
      const nextDate = await finalizeProblemRating(
        workspaceRoot,
        "trapping-rain-water",
        3, // Hard
        "actually it was quite hard and tricky",
        3, // AI rating
        "Used a lot of space and double pointer loops."
      );

      // Verifications
      expect(nextDate).toBeTruthy();
      
      state = await readState(workspaceRoot);
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
