import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { readState, writeState, initState } from "../src/modules/StateManager";
import type { LPState } from "../src/modules/interface/LPState";

const TEST_DIR = path.join(__dirname, "..", "test-state-output");

describe("StateManager", () => {
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
    expect(fs.existsSync(stateFile)).toBeTruthy();

    // Test reading
    const read = await readState(TEST_DIR);
    expect(read).toBeTruthy();
    expect(read.version).toBe("1.0");
    expect(read.planName).toBe("NeetCode 150");
    expect(read.problems.length).toBe(1);
    expect(read.problems[0].title).toBe("Two Sum");
  });

  it("should initialize a new state", async () => {
    const workspaceRoot = path.join(TEST_DIR, "init-workspace");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const state = await initState(workspaceRoot, "Custom Study Plan", []);
    expect(state).toBeTruthy();
    expect(state.planName).toBe("Custom Study Plan");
    
    const read = await readState(workspaceRoot);
    expect(read).toBeTruthy();
    expect(read.planName).toBe("Custom Study Plan");
  });
});
