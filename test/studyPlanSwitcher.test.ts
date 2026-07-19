import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { readState, writeState, initState } from "../src/modules/StateManager";
import { switchStudyPlan } from "../src/modules/StudyPlanSwitcher";
import type { LPState } from "../src/modules/interface/LPState";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-switcher-"));
}

import * as vscode from "vscode";

describe("StudyPlanSwitcher", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.spyOn(vscode.window, "withProgress").mockImplementation(
      (options: any, task: (progress: any, token: any) => Promise<any>) => task(null, null)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should bootstrap state if empty/new", async () => {
    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined as any);

    const seeds = [
      { id: "1", title: "Two Sum", titleSlug: "two-sum", difficulty: "Easy", topicTags: ["Arrays"] }
    ];

    const result = await switchStudyPlan(tmpDir, "neetcode-150", "NeetCode 150", async () => seeds);

    expect(result).toBe("switched");
    const state = await readState(tmpDir);
    expect(state).toBeTruthy();
    expect(state.planSlug).toBe("neetcode-150");
    expect(state.planName).toBe("NeetCode 150");
    expect(state.problems.length).toBe(1);
    expect(state.problems[0].slug).toBe("two-sum");
  });

  it("should return cancelled if switching to the same plan", async () => {
    const dummyProblem = {
      id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
      category: "Arrays", status: "pending" as const, scheduledDate: "2026-07-10",
      nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
      patterns: [], leetcodeUrl: null, youtubeId: null, solutionLink: null,
      hints: null, solution: null,
    };

    await initState(tmpDir, "NeetCode 150", [dummyProblem], "neetcode-150");

    const result = await switchStudyPlan(tmpDir, "neetcode-150", "NeetCode 150", async () => []);

    expect(result).toBe("cancelled");
  });

  it("should diff plans and handle disposition: archive", async () => {
    const initialProblems = [
      {
        id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
        category: "Arrays", status: "pending" as const, scheduledDate: "2026-07-10",
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
        patterns: ["Arrays"], leetcodeUrl: null, youtubeId: null, solutionLink: null,
        hints: null, solution: null,
      }
    ];

    await initState(tmpDir, "Plan A", initialProblems, "plan-a");

    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (msg: string, opts: any, confirmBtn: string) => Promise.resolve(confirmBtn)
    );
    vi.spyOn(vscode.window, "showQuickPick").mockImplementation((items: any[]) => {
      const match = items.find((item: any) => item.value === "archive");
      return Promise.resolve(match);
    });

    const seeds = [
      { id: "2", title: "Add Two Numbers", titleSlug: "add-two-numbers", difficulty: "Medium", topicTags: ["Linked List"] }
    ];

    const result = await switchStudyPlan(tmpDir, "plan-b", "Plan B", async () => seeds);

    expect(result).toBe("switched");
    const updatedState = await readState(tmpDir);
    expect(updatedState).toBeTruthy();
    expect(updatedState.planSlug).toBe("plan-b");
    expect(updatedState.problems.length).toBe(1);
    expect(updatedState.problems[0].slug).toBe("add-two-numbers");
    expect(updatedState.archivedProblems?.length).toBe(1);
    expect(updatedState.archivedProblems?.[0].slug).toBe("two-sum");
    expect(updatedState.archivedProblems?.[0].switchedOut).toBe(true);
  });

  it("should diff plans and handle disposition: skip", async () => {
    const initialProblems = [
      {
        id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
        category: "Arrays", status: "pending" as const, scheduledDate: "2026-07-10",
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
        patterns: ["Arrays"], leetcodeUrl: null, youtubeId: null, solutionLink: null,
        hints: null, solution: null,
      }
    ];

    await initState(tmpDir, "Plan A", initialProblems, "plan-a");

    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (msg: string, opts: any, confirmBtn: string) => Promise.resolve(confirmBtn)
    );
    vi.spyOn(vscode.window, "showQuickPick").mockImplementation((items: any[]) => {
      const match = items.find((item: any) => item.value === "skip");
      return Promise.resolve(match);
    });

    const seeds = [
      { id: "2", title: "Add Two Numbers", titleSlug: "add-two-numbers", difficulty: "Medium", topicTags: ["Linked List"] }
    ];

    const result = await switchStudyPlan(tmpDir, "plan-b", "Plan B", async () => seeds);

    expect(result).toBe("switched");
    const updatedState = await readState(tmpDir);
    expect(updatedState).toBeTruthy();
    expect(updatedState.problems.length).toBe(2);

    const twoSum = updatedState.problems.find(p => p.slug === "two-sum");
    expect(twoSum).toBeTruthy();
    expect(twoSum.status).toBe("skipped");
    expect(twoSum.switchedOut).toBe(true);
  });

  it("should diff plans and handle disposition: remove", async () => {
    const initialProblems = [
      {
        id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
        category: "Arrays", status: "pending" as const, scheduledDate: "2026-07-10",
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
        patterns: ["Arrays"], leetcodeUrl: null, youtubeId: null, solutionLink: null,
        hints: null, solution: null,
      }
    ];

    await initState(tmpDir, "Plan A", initialProblems, "plan-a");

    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (msg: string, opts: any, confirmBtn: string) => Promise.resolve(confirmBtn)
    );
    vi.spyOn(vscode.window, "showQuickPick").mockImplementation((items: any[]) => {
      const match = items.find((item: any) => item.value === "remove");
      return Promise.resolve(match);
    });

    const seeds = [
      { id: "2", title: "Add Two Numbers", titleSlug: "add-two-numbers", difficulty: "Medium", topicTags: ["Linked List"] }
    ];

    const result = await switchStudyPlan(tmpDir, "plan-b", "Plan B", async () => seeds);

    expect(result).toBe("switched");
    const updatedState = await readState(tmpDir);
    expect(updatedState).toBeTruthy();
    expect(updatedState.problems.length).toBe(1);
    expect(updatedState.problems[0].slug).toBe("add-two-numbers");
    expect(updatedState.archivedProblems?.length).toBe(0);
  });

  it("should auto-restore switched-out problems when switching back to their plan", async () => {
    const initialProblems = [
      {
        id: 2, title: "Add Two Numbers", slug: "add-two-numbers", difficulty: "Medium",
        category: "Linked List", status: "pending" as const, scheduledDate: "2026-07-10",
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
        patterns: ["Linked List"], leetcodeUrl: null, youtubeId: null, solutionLink: null,
        hints: null, solution: null,
      }
    ];

    const archivedProblems = [
      {
        id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
        category: "Arrays", status: "skipped" as const, scheduledDate: "2026-07-10",
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
        patterns: ["Arrays"], leetcodeUrl: null, youtubeId: null, solutionLink: null,
        hints: null, solution: null, switchedOut: true,
      }
    ];

    const state = await initState(tmpDir, "Plan B", initialProblems, "plan-b");
    state.archivedProblems = archivedProblems;
    await writeState(tmpDir, state);

    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (msg: string, opts: any, confirmBtn: string) => Promise.resolve(confirmBtn)
    );
    vi.spyOn(vscode.window, "showQuickPick").mockImplementation((items: any[]) => {
      const match = items.find((item: any) => item.value === "archive");
      return Promise.resolve(match);
    });

    const seeds = [
      { id: "1", title: "Two Sum", titleSlug: "two-sum", difficulty: "Easy", topicTags: ["Arrays"] }
    ];

    const result = await switchStudyPlan(tmpDir, "plan-a", "Plan A", async () => seeds);

    expect(result).toBe("switched");
    const updatedState = await readState(tmpDir);
    expect(updatedState).toBeTruthy();
    expect(updatedState.planSlug).toBe("plan-a");

    const twoSum = updatedState.problems.find(p => p.slug === "two-sum");
    expect(twoSum).toBeTruthy();
    expect(twoSum.status).toBe("pending");
    expect(twoSum.switchedOut).toBe(undefined);
    expect(updatedState.archivedProblems?.length).toBe(1);
    expect(updatedState.archivedProblems[0].slug).toBe("add-two-numbers");
  });

  it("user cancels confirmation dialog → returns cancelled", async () => {
    const problems = [{
      id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
      category: "Arrays", status: "pending" as const, scheduledDate: "2026-07-10",
      nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
      patterns: [], leetcodeUrl: null, youtubeId: null, solutionLink: null,
      hints: null, solution: null,
    }];
    await initState(tmpDir, "Plan A", problems, "plan-a");

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined as any);

    const seeds = [
      { id: "2", title: "New Problem", titleSlug: "new-problem", difficulty: "Easy", topicTags: [] }
    ];
    const result = await switchStudyPlan(tmpDir, "plan-b", "Plan B", async () => seeds);
    expect(result).toBe("cancelled");
  });

  it("user cancels QuickPick disposition → old problems kept", async () => {
    const problems = [{
      id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
      category: "Arrays", status: "pending" as const, scheduledDate: "2026-07-10",
      nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
      patterns: [], leetcodeUrl: null, youtubeId: null, solutionLink: null,
      hints: null, solution: null,
    }];
    await initState(tmpDir, "Plan A", problems, "plan-a");

    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (msg: string, opts: any, confirmBtn: string) => Promise.resolve(confirmBtn)
    );
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined as any);

    const seeds = [
      { id: "2", title: "New Problem", titleSlug: "new-problem", difficulty: "Easy", topicTags: [] }
    ];
    const result = await switchStudyPlan(tmpDir, "plan-b", "Plan B", async () => seeds);
    expect(result).toBe("cancelled");
  });

  it("switch with zero old-only problems → no QuickPick shown, switches directly", async () => {
    const problems = [{
      id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy",
      category: "Arrays", status: "pending" as const, scheduledDate: "2026-07-10",
      nextRepetitionDate: null, repetitionLevel: 0, completionHistory: [],
      patterns: [], leetcodeUrl: null, youtubeId: null, solutionLink: null,
      hints: null, solution: null,
    }];
    await initState(tmpDir, "Plan A", problems, "plan-a");

    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (msg: string, opts: any, confirmBtn: string) => Promise.resolve(confirmBtn)
    );
    const quickPickSpy = vi.spyOn(vscode.window, "showQuickPick");

    const seeds = [
      { id: "1", title: "Two Sum", titleSlug: "two-sum", difficulty: "Easy", topicTags: ["Arrays"] }
    ];
    const result = await switchStudyPlan(tmpDir, "plan-b", "Plan B", async () => seeds);
    expect(result).toBe("switched");
    expect(quickPickSpy).not.toHaveBeenCalled();
  });

  it("seed fetch returns empty array → state has 0 problems, returns switched", async () => {
    const result = await switchStudyPlan(tmpDir, "empty-plan", "Empty Plan", async () => []);
    expect(result).toBe("switched");
    const state = await readState(tmpDir);
    expect(state).toBeTruthy();
    expect(state.planSlug).toBe("empty-plan");
    expect(state.problems.length).toBe(0);
  });
});
