

import * as fs from "fs";
import * as path from "path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { captureSnapshot, getSnapshots, getLatestSnapshot } from "../src/modules/SnapshotManager";
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
    const snapshotBaseDir = path.join(workspaceRoot, ".leetplus", "snapshots", "1");
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
});
