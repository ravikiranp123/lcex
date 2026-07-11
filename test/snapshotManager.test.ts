

import * as fs from "fs";
import * as path from "path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { captureSnapshot, getSnapshots, getLatestSnapshot, finalizeProblemRating } from "../src/modules/SnapshotManager";
import { readState, writeState, initState } from "../src/modules/StateManager";
import { recordHintAccess, getHintAccessCount } from "../src/modules/HintFile";
import type { LPState } from "../src/modules/interface/LPState";

const TEST_DIR = path.join(__dirname, "..", "test-snapshot-output");

describe("SnapshotManager", () => {
  before(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  after(() => {
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
    assert.strictEqual(getHintAccessCount("two-sum"), 2);

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
    assert.ok(snap, "Should return a snapshot object");
    assert.strictEqual(snap.rating, 2);
    assert.strictEqual(snap.notes, "Used a map approach");
    assert.strictEqual(snap.hintsUsed, 2, "Should capture hint accesses count");
    
    // Verifying HintCount reset
    assert.strictEqual(getHintAccessCount("two-sum"), 0, "Hint count should be reset after capture");

    // Verify snapshot file creation
    const snapshotBaseDir = path.join(workspaceRoot, ".leetplus", "snapshots", "two-sum");
    assert.ok(fs.existsSync(snapshotBaseDir), "Snapshots subdirectory should be created");
    
    const files = fs.readdirSync(snapshotBaseDir);
    assert.strictEqual(files.length, 1, "One snapshot file should be written");
    assert.ok(files[0].endsWith(".ts"), "Snapshot file should preserve original extension");

    // Verify state updating
    const state = await readState(workspaceRoot);
    assert.ok(state, "Should read updated state");
    assert.strictEqual(state.problems[0].status, "completed");
    assert.strictEqual(state.problems[0].repetitionLevel, 1, "Level should increase for Good rating");
    assert.ok(state.problems[0].nextRepetitionDate, "Should schedule next repetition date");
    assert.strictEqual(state.problems[0].completionHistory.length, 1);
    assert.strictEqual(state.problems[0].completionHistory[0].notes, "Used a map approach");
    assert.strictEqual(state.currentStreak, 1, "Streak should update to 1");

    // Verify snapshot getters
    const snaps = await getSnapshots(workspaceRoot, 1, "two-sum");
    assert.strictEqual(snaps.length, 1);
    assert.strictEqual(snaps[0].notes, "Used a map approach");

    const latest = await getLatestSnapshot(workspaceRoot, 1, "two-sum");
    assert.ok(latest);
    assert.strictEqual(latest.notes, "Used a map approach");
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
      assert.ok(snapshotFiles.includes("test.patch"), "test.patch should be copied to snapshots directory");

      // Verify diffs/1/ is deleted
      assert.strictEqual(fs.existsSync(diffsDir), false, "diffs directory should be deleted");
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
      assert.ok(snapshotFiles.includes("test.patch"), "test.patch should be copied to snapshots directory");

      // Verify diffs/1/ is retained
      assert.strictEqual(fs.existsSync(diffsDir), true, "diffs directory should be retained");
      assert.strictEqual(fs.existsSync(path.join(diffsDir, "test.patch")), true, "test.patch should remain in diffs");
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
      assert.strictEqual(snapshotFiles.includes("test.patch"), false, "test.patch should NOT be copied");

      // Verify diffs/1/ is deleted
      assert.strictEqual(fs.existsSync(diffsDir), false, "diffs directory should be deleted");
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
      assert.strictEqual(state?.problems[0].completionHistory[0].rating, 2);
      assert.strictEqual(state?.problems[0].repetitionLevel, 1);

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
      assert.ok(nextDate, "Should return a date string");
      
      state = await readState(workspaceRoot);
      const problem = state?.problems[0];
      assert.ok(problem);
      assert.strictEqual(problem.status, "completed");
      assert.strictEqual(problem.repetitionLevel, 0, "Level should decrease to 0 for Hard rating from 0");
      assert.strictEqual(problem.completionHistory.length, 1);
      
      const snap = problem.completionHistory[0];
      assert.strictEqual(snap.rating, 3);
      assert.strictEqual(snap.notes, "actually it was quite hard and tricky");
      assert.strictEqual(snap.aiRating, 3);
      assert.strictEqual(snap.aiJustification, "Used a lot of space and double pointer loops.");
    });
  });
});
