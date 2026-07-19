import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import * as vscode from "vscode";
import { generateDailyPlan } from "../src/modules/DailyPlanGenerator";
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
});
