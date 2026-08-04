import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import * as vscode from "vscode";
import { generateDailyPlan, bootstrapStateFromStudyPlan, loadSeedsFromLocalDataFile } from "../src/modules/DailyPlanGenerator";
import { initState, readState } from "../src/modules/StateManager";
import { updateSRSModeInConfig } from "../src/modules/LeetPlusConfig";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-dailygen-"));
}

describe("DailyPlanGenerator", () => {
  let tmpDir: string;
  let originalFolders: any;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalFolders = vscode.workspace.workspaceFolders;
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const setupMockState = async (dir: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const problems = [
      {
        id: 1, title: "Normal Review Problem", slug: "normal-review", difficulty: "Easy",
        category: "Arrays", status: "completed" as const, scheduledDate: yesterdayStr,
        nextRepetitionDate: todayStr, repetitionLevel: 1,
        completionHistory: [{ date: yesterdayStr + "T12:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 100, hintsUsed: 0, patternsDetected: [] }]
      },
      {
        id: 2, title: "Urgent Review Problem", slug: "urgent-review", difficulty: "Medium",
        category: "Linked List", status: "completed" as const, scheduledDate: yesterdayStr,
        nextRepetitionDate: todayStr, repetitionLevel: 1,
        completionHistory: [{ date: yesterdayStr + "T12:00:00.000Z", rating: 4, notes: "", timeSpentSeconds: 100, hintsUsed: 0, patternsDetected: [] }]
      },
      {
        id: 3, title: "Pending HashMap Problem", slug: "pending-hashmap", difficulty: "Easy",
        category: "Hash Map", status: "pending" as const, scheduledDate: todayStr,
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [], patterns: ["Hash Map"]
      },
      {
        id: 4, title: "Pending BinarySearch Problem", slug: "pending-binarysearch", difficulty: "Medium",
        category: "Binary Search", status: "pending" as const, scheduledDate: todayStr,
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [], patterns: ["Binary Search"]
      }
    ];

    await initState(dir, "Test Roadmap", problems);
    const configDir = path.join(dir, ".leetplus");
    fs.mkdirSync(configDir, { recursive: true });
  };

  it("should schedule interleaved round-robin correctly and respect weak pattern prioritization", async () => {
    await setupMockState(tmpDir);

    fs.writeFileSync(path.join(tmpDir, ".leetplus", "config.json"), JSON.stringify({
      srs: { enabled: true, problemsPerDay: 4, defaultMode: "interleaved" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();
    state.patternMastery = { "Hash Map": 0.9, "Binary Search": 0.2 };

    const plan = await generateDailyPlan(tmpDir, state);

    expect(plan.problems.length).toBe(4);
    expect(plan.problems).toEqual([
      { id: 2, type: "rep" },
      { id: 4, type: "new" },
      { id: 1, type: "rep" },
      { id: 3, type: "new" }
    ]);
  });

  it("should handle review-first mode: urgent -> normal -> pending", async () => {
    await setupMockState(tmpDir);

    fs.writeFileSync(path.join(tmpDir, ".leetplus", "config.json"), JSON.stringify({
      srs: { enabled: true, problemsPerDay: 4, defaultMode: "review-first" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();

    const plan = await generateDailyPlan(tmpDir, state);

    expect(plan.problems.length).toBe(4);
    expect(plan.problems[0]).toEqual({ id: 2, type: "rep" });
    expect(plan.problems[1]).toEqual({ id: 1, type: "rep" });
  });

  it("should handle push mode: urgent -> pending -> normal", async () => {
    await setupMockState(tmpDir);

    fs.writeFileSync(path.join(tmpDir, ".leetplus", "config.json"), JSON.stringify({
      srs: { enabled: true, problemsPerDay: 4, defaultMode: "push" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();

    const plan = await generateDailyPlan(tmpDir, state);

    expect(plan.problems.length).toBe(4);
    expect(plan.problems[0]).toEqual({ id: 2, type: "rep" });
    expect(plan.problems[1].type).toBe("new");
    expect(plan.problems[2].type).toBe("new");
    expect(plan.problems[3]).toEqual({ id: 1, type: "rep" });
  });

  it("should handle recap mode: only reviews, fallback to random completed if empty", async () => {
    await setupMockState(tmpDir);

    fs.writeFileSync(path.join(tmpDir, ".leetplus", "config.json"), JSON.stringify({
      srs: { enabled: true, problemsPerDay: 3, defaultMode: "recap" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();

    const plan = await generateDailyPlan(tmpDir, state);

    expect(plan.problems.length).toBe(2);
    expect(plan.problems[0]).toEqual({ id: 2, type: "rep" });
    expect(plan.problems[1]).toEqual({ id: 1, type: "rep" });
  });

  it("should return empty plan when state is null without throwing", async () => {
    fs.mkdirSync(path.join(tmpDir, ".leetplus"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".leetplus", "config.json"), JSON.stringify({
      srs: { enabled: true, problemsPerDay: 4, defaultMode: "interleaved" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const plan = await generateDailyPlan(tmpDir, null as any);

    expect(plan).toBeDefined();
    expect(plan.problems).toEqual([]);
    expect(plan.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("should include all pending problems when SRS is disabled", async () => {
    await setupMockState(tmpDir);

    fs.writeFileSync(path.join(tmpDir, ".leetplus", "config.json"), JSON.stringify({
      srs: { enabled: false, problemsPerDay: 4, defaultMode: "interleaved" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();

    const plan = await generateDailyPlan(tmpDir, state);

    expect(plan.problems.length).toBe(4);
    const pendingProblems = plan.problems.filter((p) => p.type === "new");
    expect(pendingProblems.length).toBe(2);
  });

  it("should write plan file to .leetplus/plans/<today>.json", async () => {
    await setupMockState(tmpDir);

    fs.writeFileSync(path.join(tmpDir, ".leetplus", "config.json"), JSON.stringify({
      srs: { enabled: true, problemsPerDay: 4, defaultMode: "interleaved" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();

    const plan = await generateDailyPlan(tmpDir, state);

    const todayStr = new Date().toISOString().slice(0, 10);
    const planFile = path.join(tmpDir, ".leetplus", "plans", `${todayStr}.json`);
    expect(fs.existsSync(planFile)).toBe(true);

    const planContent = JSON.parse(fs.readFileSync(planFile, "utf-8"));
    expect(planContent.date).toBe(todayStr);
    expect(planContent.mode).toBe("interleaved");
    expect(planContent.problems).toEqual(plan.problems);
  });

  it("should return empty plan in recap mode with no completed problems", async () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const problems = [
      {
        id: 1, title: "Pending Problem", slug: "pending-problem", difficulty: "Easy",
        category: "Arrays", status: "pending" as const, scheduledDate: todayStr,
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: []
      }
    ];

    await initState(tmpDir, "Test Roadmap", problems);
    const configDir = path.join(tmpDir, ".leetplus");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({
      srs: { enabled: true, problemsPerDay: 3, defaultMode: "recap" }
    }), "utf-8");

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();

    const plan = await generateDailyPlan(tmpDir, state);

    expect(plan.problems).toEqual([]);
  });

  it("should persist selected Daily Plan mode to config.json", async () => {
    const configPath = path.join(tmpDir, ".leetplus", "config.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ theme: "leetcode-dark" }), "utf-8");

    const mockFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    updateSRSModeInConfig(mockFolders, "review-first");

    const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(content.srs?.defaultMode).toBe("review-first");
    expect(content.theme).toBe("leetcode-dark");
  });

  it("bootstrapStateFromStudyPlan should return 0 when fetch throws", async () => {
    const state = { problems: [], version: "1.0" as const, planName: "Test", planSlug: "test", patternMastery: {} };
    const failingFetch = async () => { throw new Error("Network error"); };

    const count = await bootstrapStateFromStudyPlan(tmpDir, state, failingFetch);

    expect(count).toBe(0);
    expect(state.problems.length).toBe(0);
  });

  it("loadSeedsFromLocalDataFile should return null when file does not exist in either location", () => {
    const result = loadSeedsFromLocalDataFile(tmpDir, "nonexistent-plan");
    expect(result).toBeNull();
  });

  it("loadSeedsFromLocalDataFile should find plan in .leetplus/plans/ when .leetplus/data/ is absent", () => {
    const plansDir = path.join(tmpDir, ".leetplus", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(
      path.join(plansDir, "neetcode-150.json"),
      JSON.stringify({ "Arrays & Hashing": ["two-sum", "contains-duplicate"] }),
      "utf-8"
    );

    const seeds = loadSeedsFromLocalDataFile(tmpDir, "neetcode-150");

    expect(seeds).toBeTruthy();
    expect(seeds?.length).toBe(2);
    expect(seeds?.[0].titleSlug).toBe("two-sum");
    expect(seeds?.[0].topicTags).toEqual(["Arrays & Hashing"]);
  });

  it("loadSeedsFromLocalDataFile should prefer .leetplus/data/ over .leetplus/plans/", () => {
    const dataDir = path.join(tmpDir, ".leetplus", "data");
    const plansDir = path.join(tmpDir, ".leetplus", "plans");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "my-plan.json"),
      JSON.stringify({ "From Data": ["data-problem"] }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(plansDir, "my-plan.json"),
      JSON.stringify({ "From Plans": ["plans-problem"] }),
      "utf-8"
    );

    const seeds = loadSeedsFromLocalDataFile(tmpDir, "my-plan");

    expect(seeds).toBeTruthy();
    expect(seeds?.[0].topicTags).toEqual(["From Data"]);
  });

  it("loadSeedsFromLocalDataFile should return null when file has invalid JSON", () => {
    const dataDir = path.join(tmpDir, ".leetplus", "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "bad-plan.json"), "{ invalid json content", "utf-8");

    const result = loadSeedsFromLocalDataFile(tmpDir, "bad-plan");

    expect(result).toBeNull();
  });

  it("loadSeedsFromLocalDataFile should parse custom relative localPath correctly", () => {
    const customRelPath = "custom_plans/my-plan.json";
    const fullPath = path.join(tmpDir, customRelPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(
      fullPath,
      JSON.stringify({
        "Arrays & Hashing": ["two-sum", "valid-anagram"],
        "Two Pointers": ["3sum"]
      }),
      "utf-8"
    );

    const seeds = loadSeedsFromLocalDataFile(tmpDir, "my-plan", customRelPath);

    expect(seeds).toBeTruthy();
    expect(seeds?.length).toBe(3);
    expect(seeds?.[0]).toEqual({
      id: "two-sum",
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Medium",
      topicTags: ["Arrays & Hashing"]
    });
    expect(seeds?.[2]).toEqual({
      id: "3sum",
      title: "3sum",
      titleSlug: "3sum",
      difficulty: "Medium",
      topicTags: ["Two Pointers"]
    });
  });

  it("loadSeedsFromLocalDataFile should parse absolute localPath correctly", () => {
    const absPath = path.join(tmpDir, "abs-plan.json");
    fs.writeFileSync(
      absPath,
      JSON.stringify({ "Stack": ["valid-parentheses"] }),
      "utf-8"
    );

    const seeds = loadSeedsFromLocalDataFile(tmpDir, "abs-plan", absPath);

    expect(seeds).toBeTruthy();
    expect(seeds?.length).toBe(1);
    expect(seeds?.[0].titleSlug).toBe("valid-parentheses");
    expect(seeds?.[0].title).toBe("Valid Parentheses");
  });

  it("loadSeedsFromLocalDataFile should ignore non-array category values and non-string slugs", () => {
    const dataDir = path.join(tmpDir, ".leetplus", "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "mixed-plan.json"),
      JSON.stringify({
        "InvalidCategory": "not-an-array",
        "EmptyCategory": [],
        "ValidCategory": [123, null, "container-with-most-water", true]
      }),
      "utf-8"
    );

    const seeds = loadSeedsFromLocalDataFile(tmpDir, "mixed-plan");

    expect(seeds).toBeTruthy();
    expect(seeds?.length).toBe(1);
    expect(seeds?.[0].titleSlug).toBe("container-with-most-water");
    expect(seeds?.[0].topicTags).toEqual(["ValidCategory"]);
  });

  it("loadSeedsFromLocalDataFile should parse problem objects with numeric IDs and rich metadata", () => {
    const dataDir = path.join(tmpDir, ".leetplus", "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "object-plan.json"),
      JSON.stringify({
        "Arrays & Hashing": [
          {
            id: 217,
            title: "Contains Duplicate",
            slug: "contains-duplicate",
            leetcode_url: "https://leetcode.com/problems/contains-duplicate/",
            youtube_id: "3OamzN90k_s",
            hints: ["Hint 1", "Hint 2"],
            solution: { explanation: "Use a hash set", code: { python: "class Solution..." } }
          }
        ]
      }),
      "utf-8"
    );

    const seeds = loadSeedsFromLocalDataFile(tmpDir, "object-plan");

    expect(seeds).toBeTruthy();
    expect(seeds?.length).toBe(1);
    expect(seeds?.[0].id).toBe(217);
    expect(seeds?.[0].title).toBe("Contains Duplicate");
    expect(seeds?.[0].titleSlug).toBe("contains-duplicate");
    expect(seeds?.[0].youtubeId).toBe("3OamzN90k_s");
    expect(seeds?.[0].hints).toEqual(["Hint 1", "Hint 2"]);
    expect(seeds?.[0].solution?.explanation).toBe("Use a hash set");
  });
});

import { topUpDailyPlan } from "../src/modules/DailyPlanGenerator";

describe("topUpDailyPlan", () => {
  let tmpDir: string;
  let originalFolders: any;

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  /** Build a minimal LPState with a mix of pending and completed problems. */
  function makeState() {
    return {
      planName: "Test Plan",
      planSlug: "test-plan",
      problems: [
        { id: 1, title: "P1", slug: "p1", difficulty: "Easy", category: "Arrays", status: "pending" as const, scheduledDate: todayStr, nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [] },
        { id: 2, title: "P2", slug: "p2", difficulty: "Easy", category: "Arrays", status: "pending" as const, scheduledDate: todayStr, nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [] },
        { id: 3, title: "P3", slug: "p3", difficulty: "Medium", category: "Graphs", status: "pending" as const, scheduledDate: todayStr, nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [] },
        {
          id: 4, title: "P4", slug: "p4", difficulty: "Hard", category: "DP", status: "completed" as const,
          scheduledDate: yesterdayStr, nextRepetitionDate: todayStr, repetitionLevel: 1,
          completionHistory: [{ date: yesterdayStr + "T12:00:00Z", rating: 2, notes: "", timeSpentSeconds: 60, hintsUsed: 0, patternsDetected: [] }]
        },
        {
          id: 5, title: "P5", slug: "p5", difficulty: "Easy", category: "Arrays", status: "completed" as const,
          scheduledDate: yesterdayStr, nextRepetitionDate: todayStr, repetitionLevel: 1,
          completionHistory: [{ date: yesterdayStr + "T12:00:00Z", rating: 2, notes: "", timeSpentSeconds: 60, hintsUsed: 0, patternsDetected: [] }]
        },
      ],
      patternMastery: {},
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-topup-"));
    originalFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 },
    ];
    fs.mkdirSync(path.join(tmpDir, ".leetplus", "plans"), { recursive: true });
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends new problems to an existing plan without duplicating already-scheduled ones", async () => {
    // Start with problem 1 already in today's plan
    const initialPlan = { date: todayStr, mode: "interleaved", problems: [{ id: 1, type: "new" }] };
    fs.writeFileSync(
      path.join(tmpDir, ".leetplus", "plans", `${todayStr}.json`),
      JSON.stringify(initialPlan),
      "utf-8"
    );

    const state = makeState() as any;
    const updated = await topUpDailyPlan(tmpDir, state, 3);

    // Should have original 1 plus 3 more, none of which is id=1
    expect(updated.problems.length).toBe(4);
    const ids = updated.problems.map((p) => p.id);
    expect(ids.filter((id) => id === 1).length).toBe(1); // still exactly one copy
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it("respects the requested count — does not add more than asked", async () => {
    const state = makeState() as any;
    const updated = await topUpDailyPlan(tmpDir, state, 2);

    expect(updated.problems.length).toBe(2);
  });

  it("returns existing plan unchanged when no pending/overdue problems are available", async () => {
    // All problems already scheduled
    const allIds = [1, 2, 3, 4, 5].map((id) => ({ id, type: "new" as const }));
    const initialPlan = { date: todayStr, mode: "push", problems: allIds };
    fs.writeFileSync(
      path.join(tmpDir, ".leetplus", "plans", `${todayStr}.json`),
      JSON.stringify(initialPlan),
      "utf-8"
    );

    const state = makeState() as any;
    const result = await topUpDailyPlan(tmpDir, state, 5);

    // Nothing added — returns the existing plan as-is
    expect(result.problems.length).toBe(5);
    expect(result.mode).toBe("push");
  });

  it("creates today's plan file if it does not exist yet", async () => {
    const planFile = path.join(tmpDir, ".leetplus", "plans", `${todayStr}.json`);
    expect(fs.existsSync(planFile)).toBe(false);

    const state = makeState() as any;
    await topUpDailyPlan(tmpDir, state, 2);

    expect(fs.existsSync(planFile)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(planFile, "utf-8"));
    expect(saved.problems.length).toBe(2);
  });

  it("preserves existing plan mode in the updated plan file", async () => {
    const initialPlan = { date: todayStr, mode: "review-first", problems: [{ id: 1, type: "new" }] };
    fs.writeFileSync(
      path.join(tmpDir, ".leetplus", "plans", `${todayStr}.json`),
      JSON.stringify(initialPlan),
      "utf-8"
    );

    const state = makeState() as any;
    const updated = await topUpDailyPlan(tmpDir, state, 1);

    expect(updated.mode).toBe("review-first");
    const saved = JSON.parse(fs.readFileSync(
      path.join(tmpDir, ".leetplus", "plans", `${todayStr}.json`), "utf-8"
    ));
    expect(saved.mode).toBe("review-first");
  });

  it("includes overdue repetitions (completed problems with nextRepetitionDate <= today)", async () => {
    // Put only pending problems in the plan already
    const initialPlan = { date: todayStr, mode: "interleaved", problems: [{ id: 1, type: "new" }, { id: 2, type: "new" }, { id: 3, type: "new" }] };
    fs.writeFileSync(
      path.join(tmpDir, ".leetplus", "plans", `${todayStr}.json`),
      JSON.stringify(initialPlan),
      "utf-8"
    );

    const state = makeState() as any;
    const updated = await topUpDailyPlan(tmpDir, state, 2);

    // Overdue problems (id 4, 5) should be appended as "rep"
    const addedTypes = updated.problems.slice(3).map((p) => p.type);
    expect(addedTypes.every((t) => t === "rep")).toBe(true);
    const addedIds = updated.problems.slice(3).map((p) => p.id);
    expect(addedIds.every((id) => [4, 5].includes(id))).toBe(true);
  });
});
