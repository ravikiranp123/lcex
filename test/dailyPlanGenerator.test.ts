import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import * as vscode from "vscode";
import { generateDailyPlan } from "../src/modules/DailyPlanGenerator";
import { initState, readState } from "../src/modules/StateManager";
import { updateSRSModeInConfig } from "../src/modules/LeetPlusConfig";

const TEST_DIR = path.join(__dirname, "..", "test-daily-plan-generator-output");

describe("DailyPlanGenerator", () => {
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

  const setupMockState = async (workspaceRoot: string) => {
    // We create:
    // Problem 1: completed, due for review, normal review (rating = 2)
    // Problem 2: completed, due for review, urgent review (rating = 4)
    // Problem 3: pending, under "Hash Map" pattern
    // Problem 4: pending, under "Binary Search" pattern
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const problems = [
      {
        id: 1,
        title: "Normal Review Problem",
        slug: "normal-review",
        difficulty: "Easy",
        category: "Arrays",
        status: "completed" as const,
        scheduledDate: yesterdayStr,
        nextRepetitionDate: todayStr,
        repetitionLevel: 1,
        completionHistory: [
          {
            date: yesterdayStr + "T12:00:00.000Z",
            rating: 2, // Good rating
            notes: "",
            timeSpentSeconds: 100,
            hintsUsed: 0,
            patternsDetected: []
          }
        ]
      },
      {
        id: 2,
        title: "Urgent Review Problem",
        slug: "urgent-review",
        difficulty: "Medium",
        category: "Linked List",
        status: "completed" as const,
        scheduledDate: yesterdayStr,
        nextRepetitionDate: todayStr,
        repetitionLevel: 1,
        completionHistory: [
          {
            date: yesterdayStr + "T12:00:00.000Z",
            rating: 4, // Again rating (urgent review)
            notes: "",
            timeSpentSeconds: 100,
            hintsUsed: 0,
            patternsDetected: []
          }
        ]
      },
      {
        id: 3,
        title: "Pending HashMap Problem",
        slug: "pending-hashmap",
        difficulty: "Easy",
        category: "Hash Map",
        status: "pending" as const,
        scheduledDate: todayStr,
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Hash Map"]
      },
      {
        id: 4,
        title: "Pending BinarySearch Problem",
        slug: "pending-binarysearch",
        difficulty: "Medium",
        category: "Binary Search",
        status: "pending" as const,
        scheduledDate: todayStr,
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Binary Search"]
      }
    ];

    await initState(workspaceRoot, "Test Roadmap", problems);

    // Write config.json
    const configDir = path.join(workspaceRoot, ".leetplus");
    fs.mkdirSync(configDir, { recursive: true });

    return { workspaceRoot };
  };

  it("should schedule interleaved round-robin correctly and respect weak pattern prioritization", async () => {
    const workspaceRoot = path.join(TEST_DIR, "interleaved-test");
    await setupMockState(workspaceRoot);

    // Write config pointing to interleaved mode
    const configPath = path.join(workspaceRoot, ".leetplus", "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        srs: {
          enabled: true,
          problemsPerDay: 4,
          defaultMode: "interleaved"
        }
      }),
      "utf-8"
    );

    // Mock VS Code workspace folders
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: workspaceRoot } as any,
        name: "TestWorkspace",
        index: 0
      }
    ];

    try {
      // Setup state with "Binary Search" as the weakest pattern:
      const state = await readState(workspaceRoot);
      expect(state).toBeTruthy();
      state.patternMastery = {
        "Hash Map": 0.9,
        "Binary Search": 0.2 // Binary Search is much weaker!
      };

      const plan = await generateDailyPlan(workspaceRoot, state);

      // Verify the generated plan:
      // Binary Search problem (Problem 4) should be prioritized over HashMap problem (Problem 3)
      // Queues:
      // urgent: [Problem 2]
      // normal: [Problem 1]
      // pending: [Problem 4, Problem 3] (prioritized: 4 then 3)
      // Mode: Interleaved (round-robin: 1 urgent -> 1 new -> 1 normal -> 1 new)
      // Result order should be:
      // 1. urgent: Problem 2
      // 2. new: Problem 4
      // 3. normal: Problem 1
      // 4. new: Problem 3
      expect(plan.problems.length).toBe(4);
      expect(plan.problems).toEqual([
        { id: 2, type: "rep" },
        { id: 4, type: "new" },
        { id: 1, type: "rep" },
        { id: 3, type: "new" }
      ]);
    } finally {
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });

  it("should handle review-first mode: urgent -> normal -> pending", async () => {
    const workspaceRoot = path.join(TEST_DIR, "review-first-test");
    await setupMockState(workspaceRoot);

    const configPath = path.join(workspaceRoot, ".leetplus", "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        srs: {
          enabled: true,
          problemsPerDay: 4,
          defaultMode: "review-first"
        }
      }),
      "utf-8"
    );

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: workspaceRoot } as any,
        name: "TestWorkspace",
        index: 0
      }
    ];

    try {
      const state = await readState(workspaceRoot);
      expect(state).toBeTruthy();

      const plan = await generateDailyPlan(workspaceRoot, state);

      // Expected: Problem 2 (urgent), Problem 1 (normal), Problem 3/4 (new)
      expect(plan.problems.length).toBe(4);
      expect(plan.problems[0]).toEqual({ id: 2, type: "rep" });
      expect(plan.problems[1]).toEqual({ id: 1, type: "rep" });
    } finally {
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });

  it("should handle push mode: urgent -> pending -> normal", async () => {
    const workspaceRoot = path.join(TEST_DIR, "push-test");
    await setupMockState(workspaceRoot);

    const configPath = path.join(workspaceRoot, ".leetplus", "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        srs: {
          enabled: true,
          problemsPerDay: 4,
          defaultMode: "push"
        }
      }),
      "utf-8"
    );

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: workspaceRoot } as any,
        name: "TestWorkspace",
        index: 0
      }
    ];

    try {
      const state = await readState(workspaceRoot);
      expect(state).toBeTruthy();

      const plan = await generateDailyPlan(workspaceRoot, state);

      // Expected: Problem 2 (urgent), Problem 3 & 4 (new), Problem 1 (normal)
      expect(plan.problems.length).toBe(4);
      expect(plan.problems[0]).toEqual({ id: 2, type: "rep" });
      expect(plan.problems[1].type).toBe("new");
      expect(plan.problems[2].type).toBe("new");
      expect(plan.problems[3]).toEqual({ id: 1, type: "rep" });
    } finally {
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });

  it("should handle recap mode: only reviews, fallback to random completed if empty", async () => {
    const workspaceRoot = path.join(TEST_DIR, "recap-test");
    await setupMockState(workspaceRoot);

    const configPath = path.join(workspaceRoot, ".leetplus", "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        srs: {
          enabled: true,
          problemsPerDay: 3,
          defaultMode: "recap"
        }
      }),
      "utf-8"
    );

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: workspaceRoot } as any,
        name: "TestWorkspace",
        index: 0
      }
    ];

    try {
      const state = await readState(workspaceRoot);
      expect(state).toBeTruthy();

      const plan = await generateDailyPlan(workspaceRoot, state);

      // Expected: only reviews (Problem 2 & Problem 1)
      expect(plan.problems.length).toBe(2);
      expect(plan.problems[0]).toEqual({ id: 2, type: "rep" });
      expect(plan.problems[1]).toEqual({ id: 1, type: "rep" });
    } finally {
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });

  it("should persist selected Daily Plan mode to config.json", async () => {
    const workspaceRoot = path.join(TEST_DIR, "persist-mode-test");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const configPath = path.join(workspaceRoot, ".leetplus", "config.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ theme: "leetcode-dark" }), "utf-8");

    const mockFolders = [
      {
        uri: { fsPath: workspaceRoot } as any,
        name: "TestWorkspace",
        index: 0
      }
    ];

    updateSRSModeInConfig(mockFolders, "review-first");

    const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(content.srs?.defaultMode).toBe("review-first");
    expect(content.theme).toBe("leetcode-dark"); // verify existing settings are preserved
  });
});

