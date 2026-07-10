import * as fs from "fs";
import * as path from "path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { readState, writeState, initState } from "../src/modules/StateManager";
import type { LPState } from "../src/modules/interface/LPState";

const TEST_DIR = path.join(__dirname, "..", "test-state-output");

describe("StateManager", () => {
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

  it("should write and read state successfully", async () => {
    const testState: LPState = {
      version: "1.0",
      planName: "NeetCode 150",
      startDate: new Date().toISOString(),
      problems: [
        {
          id: 1,
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "Easy",
          category: "Arrays & Hashing",
          status: "pending",
          scheduledDate: new Date().toISOString(),
          nextRepetitionDate: null,
          repetitionLevel: 0,
          completionHistory: [],
          patterns: ["Two Pointers"],
          leetcodeUrl: "https://leetcode.com/problems/two-sum",
          youtubeId: "abcd",
          solutionLink: null,
          hints: null,
          solution: null,
        },
      ],
      currentStreak: 0,
      bestStreak: 0,
      lastActivityDate: null,
      patternMastery: {},
      designProblems: [],
      behavioralStories: [],
    };

    // Test writing
    await writeState(TEST_DIR, testState);
    const stateFile = path.join(TEST_DIR, ".leetplus", "state.json");
    assert.ok(fs.existsSync(stateFile), "State file should exist on disk");

    // Test reading
    const read = await readState(TEST_DIR);
    assert.ok(read, "State should be read successfully");
    assert.strictEqual(read.version, "1.0");
    assert.strictEqual(read.planName, "NeetCode 150");
    assert.strictEqual(read.problems.length, 1);
    assert.strictEqual(read.problems[0].title, "Two Sum");
  });

  it("should initialize a new state", async () => {
    const workspaceRoot = path.join(TEST_DIR, "init-workspace");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const state = await initState(workspaceRoot, "Custom Study Plan", []);
    assert.ok(state, "Init state should return the state object");
    assert.strictEqual(state.planName, "Custom Study Plan");
    
    const read = await readState(workspaceRoot);
    assert.ok(read, "State file should exist and be readable");
    assert.strictEqual(read.planName, "Custom Study Plan");
  });
});
