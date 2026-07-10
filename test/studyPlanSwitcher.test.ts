import * as fs from "fs";
import * as path from "path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { readState, writeState, initState } from "../src/modules/StateManager";
import { switchStudyPlan } from "../src/modules/StudyPlanSwitcher";
import type { LPState } from "../src/modules/interface/LPState";

const TEST_DIR = path.join(__dirname, "..", "test-switcher-output");

describe("StudyPlanSwitcher", () => {
  const vscode = require("vscode");

  before(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    // Mock withProgress to run the task synchronously
    vscode.window.withProgress = (options: any, task: (progress: any, token: any) => Promise<any>) => {
      return task(null, null);
    };
  });


  after(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should bootstrap state if empty/new", async () => {
    const workspaceRoot = path.join(TEST_DIR, "bootstrap");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    // Mock showInformationMessage
    let shownInfoMessage = "";
    vscode.window.showInformationMessage = (msg: string) => {
      shownInfoMessage = msg;
      return Promise.resolve();
    };

    const seeds = [
      { id: "1", title: "Two Sum", titleSlug: "two-sum", difficulty: "Easy", topicTags: ["Arrays"] }
    ];

    const result = await switchStudyPlan(
      workspaceRoot,
      "neetcode-150",
      "NeetCode 150",
      async () => seeds
    );

    assert.strictEqual(result, "switched");
    const state = await readState(workspaceRoot);
    assert.ok(state);
    assert.strictEqual(state.planSlug, "neetcode-150");
    assert.strictEqual(state.planName, "NeetCode 150");
    assert.strictEqual(state.problems.length, 1);
    assert.strictEqual(state.problems[0].slug, "two-sum");
  });

  it("should return cancelled if switching to the same plan", async () => {
    const workspaceRoot = path.join(TEST_DIR, "same-plan");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const dummyProblem = {
      id: 1,
      title: "Two Sum",
      slug: "two-sum",
      difficulty: "Easy",
      category: "Arrays",
      status: "pending" as const,
      scheduledDate: "2026-07-10",
      nextRepetitionDate: null,
      repetitionLevel: 0,
      completionHistory: [],
      patterns: [],
      leetcodeUrl: null,
      youtubeId: null,
      solutionLink: null,
      hints: null,
      solution: null,
    };

    const state = await initState(workspaceRoot, "NeetCode 150", [dummyProblem], "neetcode-150");


    const result = await switchStudyPlan(
      workspaceRoot,
      "neetcode-150",
      "NeetCode 150",
      async () => []
    );

    assert.strictEqual(result, "cancelled");
  });

  it("should diff plans and handle disposition: archive", async () => {
    const workspaceRoot = path.join(TEST_DIR, "archive-disposition");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const initialProblems = [
      {
        id: 1,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays",
        status: "pending" as const,
        scheduledDate: "2026-07-10",
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Arrays"],
        leetcodeUrl: null,
        youtubeId: null,
        solutionLink: null,
        hints: null,
        solution: null,
      }
    ];

    await initState(workspaceRoot, "Plan A", initialProblems, "plan-a");

    // Mock confirmation dialog (Return "Switch" with old-only problems)
    vscode.window.showInformationMessage = (msg: string, opts: any, confirmBtn: string) => {
      return Promise.resolve(confirmBtn);
    };

    // Mock old-only disposition QuickPick to pick "Archive"
    vscode.window.showQuickPick = (items: any[]) => {
      const match = items.find((item) => item.value === "archive");
      return Promise.resolve(match);
    };

    // Seeds of Plan B (contains a different problem)
    const seeds = [
      { id: "2", title: "Add Two Numbers", titleSlug: "add-two-numbers", difficulty: "Medium", topicTags: ["Linked List"] }
    ];

    const result = await switchStudyPlan(
      workspaceRoot,
      "plan-b",
      "Plan B",
      async () => seeds
    );

    assert.strictEqual(result, "switched");
    const updatedState = await readState(workspaceRoot);
    assert.ok(updatedState);
    assert.strictEqual(updatedState.planSlug, "plan-b");
    
    // Two Sum is archived (moved to archivedProblems)
    assert.strictEqual(updatedState.problems.length, 1);
    assert.strictEqual(updatedState.problems[0].slug, "add-two-numbers");
    assert.strictEqual(updatedState.archivedProblems?.length, 1);
    assert.strictEqual(updatedState.archivedProblems?.[0].slug, "two-sum");
    assert.strictEqual(updatedState.archivedProblems?.[0].switchedOut, true);
  });

  it("should diff plans and handle disposition: skip", async () => {
    const workspaceRoot = path.join(TEST_DIR, "skip-disposition");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const initialProblems = [
      {
        id: 1,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays",
        status: "pending" as const,
        scheduledDate: "2026-07-10",
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Arrays"],
        leetcodeUrl: null,
        youtubeId: null,
        solutionLink: null,
        hints: null,
        solution: null,
      }
    ];

    await initState(workspaceRoot, "Plan A", initialProblems, "plan-a");

    vscode.window.showInformationMessage = (msg: string, opts: any, confirmBtn: string) => {
      return Promise.resolve(confirmBtn);
    };

    vscode.window.showQuickPick = (items: any[]) => {
      const match = items.find((item) => item.value === "skip");
      return Promise.resolve(match);
    };

    const seeds = [
      { id: "2", title: "Add Two Numbers", titleSlug: "add-two-numbers", difficulty: "Medium", topicTags: ["Linked List"] }
    ];

    const result = await switchStudyPlan(
      workspaceRoot,
      "plan-b",
      "Plan B",
      async () => seeds
    );

    assert.strictEqual(result, "switched");
    const updatedState = await readState(workspaceRoot);
    assert.ok(updatedState);
    assert.strictEqual(updatedState.problems.length, 2); // both remain in problems array

    const twoSum = updatedState.problems.find(p => p.slug === "two-sum");
    assert.ok(twoSum);
    assert.strictEqual(twoSum.status, "skipped");
    assert.strictEqual(twoSum.switchedOut, true);
  });

  it("should diff plans and handle disposition: remove", async () => {
    const workspaceRoot = path.join(TEST_DIR, "remove-disposition");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const initialProblems = [
      {
        id: 1,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays",
        status: "pending" as const,
        scheduledDate: "2026-07-10",
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Arrays"],
        leetcodeUrl: null,
        youtubeId: null,
        solutionLink: null,
        hints: null,
        solution: null,
      }
    ];

    await initState(workspaceRoot, "Plan A", initialProblems, "plan-a");

    vscode.window.showInformationMessage = (msg: string, opts: any, confirmBtn: string) => {
      return Promise.resolve(confirmBtn);
    };

    vscode.window.showQuickPick = (items: any[]) => {
      const match = items.find((item) => item.value === "remove");
      return Promise.resolve(match);
    };

    const seeds = [
      { id: "2", title: "Add Two Numbers", titleSlug: "add-two-numbers", difficulty: "Medium", topicTags: ["Linked List"] }
    ];

    const result = await switchStudyPlan(
      workspaceRoot,
      "plan-b",
      "Plan B",
      async () => seeds
    );

    assert.strictEqual(result, "switched");
    const updatedState = await readState(workspaceRoot);
    assert.ok(updatedState);
    assert.strictEqual(updatedState.problems.length, 1); // only the new problem remains
    assert.strictEqual(updatedState.problems[0].slug, "add-two-numbers");
    assert.strictEqual(updatedState.archivedProblems?.length, 0);
  });

  it("should auto-restore switched-out problems when switching back to their plan", async () => {
    const workspaceRoot = path.join(TEST_DIR, "auto-restore");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const initialProblems = [
      {
        id: 2,
        title: "Add Two Numbers",
        slug: "add-two-numbers",
        difficulty: "Medium",
        category: "Linked List",
        status: "pending" as const,
        scheduledDate: "2026-07-10",
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Linked List"],
        leetcodeUrl: null,
        youtubeId: null,
        solutionLink: null,
        hints: null,
        solution: null,
      }
    ];

    const archivedProblems = [
      {
        id: 1,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays",
        status: "skipped" as const,
        scheduledDate: "2026-07-10",
        nextRepetitionDate: null,
        repetitionLevel: 0,
        completionHistory: [],
        patterns: ["Arrays"],
        leetcodeUrl: null,
        youtubeId: null,
        solutionLink: null,
        hints: null,
        solution: null,
        switchedOut: true, // marked by plan switch
      }
    ];

    const state = await initState(workspaceRoot, "Plan B", initialProblems, "plan-b");
    state.archivedProblems = archivedProblems;
    await writeState(workspaceRoot, state);

    vscode.window.showInformationMessage = (msg: string, opts: any, confirmBtn: string) => {
      return Promise.resolve(confirmBtn);
    };

    vscode.window.showQuickPick = (items: any[]) => {
      const match = items.find((item) => item.value === "archive");
      return Promise.resolve(match);
    };

    // Seeds of Plan A (contains Two Sum)
    const seeds = [
      { id: "1", title: "Two Sum", titleSlug: "two-sum", difficulty: "Easy", topicTags: ["Arrays"] }
    ];

    const result = await switchStudyPlan(
      workspaceRoot,
      "plan-a",
      "Plan A",
      async () => seeds
    );

    assert.strictEqual(result, "switched");
    const updatedState = await readState(workspaceRoot);
    assert.ok(updatedState);
    assert.strictEqual(updatedState.planSlug, "plan-a");
    
    // Two Sum should be moved back from archivedProblems, reset to status="pending" and switchedOut=undefined
    const twoSum = updatedState.problems.find(p => p.slug === "two-sum");
    assert.ok(twoSum);
    assert.strictEqual(twoSum.status, "pending");
    assert.strictEqual(twoSum.switchedOut, undefined);
    assert.strictEqual(updatedState.archivedProblems?.length, 1); // Add Two Numbers was archived from Plan B
    assert.strictEqual(updatedState.archivedProblems[0].slug, "add-two-numbers");
  });
});
