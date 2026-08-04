import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import * as vscode from "vscode";
import { DailyPlanProvider } from "../src/modules/DailyPlanProvider";
import { initState } from "../src/modules/StateManager";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-dailyplan-"));
}

describe("DailyPlanProvider", () => {
  let tmpDir: string;
  let originalFolders: any;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalFolders = vscode.workspace.workspaceFolders;
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should categorize daily plan items into Review, New, and Done correctly", async () => {
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const problems = [
      {
        id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy", category: "Arrays",
        status: "completed" as const, scheduledDate: yesterdayStr, nextRepetitionDate: todayStr,
        repetitionLevel: 1, completionHistory: [
          { date: yesterdayStr + "T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 100, hintsUsed: 0, patternsDetected: [] }
        ]
      },
      {
        id: 2, title: "Add Two Numbers", slug: "add-two-numbers", difficulty: "Medium", category: "Linked List",
        status: "completed" as const, scheduledDate: todayStr, nextRepetitionDate: todayStr,
        repetitionLevel: 1, completionHistory: [
          { date: todayStr + "T14:30:00.000Z", rating: 2, notes: "", timeSpentSeconds: 150, hintsUsed: 0, patternsDetected: [] }
        ]
      },
      {
        id: 3, title: "Longest Substring Without Repeating Characters", slug: "longest-substring",
        difficulty: "Medium", category: "Sliding Window", status: "pending" as const,
        scheduledDate: todayStr, nextRepetitionDate: null, repetitionLevel: 0, completionHistory: []
      }
    ];

    await initState(tmpDir, "Test RoadMap", problems);

    const plansDir = path.join(tmpDir, ".leetplus", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, `${todayStr}.json`), JSON.stringify({
      date: todayStr,
      problems: [{ id: 1, type: "rep" }, { id: 2, type: "rep" }, { id: 3, type: "new" }]
    }), "utf-8");

    const mockContext = { subscriptions: [], workspaceState: { get: () => undefined, update: () => Promise.resolve() } } as any;
    const provider = new DailyPlanProvider(mockContext);

    const roots = await provider.getChildren();
    expect(roots.length).toBe(3);

    const reviewRoot = roots.find(r => r.id === "review")!;
    const newRoot = roots.find(r => r.id === "new")!;
    const doneRoot = roots.find(r => r.id === "done")!;

    expect(reviewRoot.label).toBe("Review (1)");
    expect(newRoot.label).toBe("New (1)");
    expect(doneRoot.label).toBe("Done (1)");

    const reviewChildren = await provider.getChildren(reviewRoot);
    expect(reviewChildren.length).toBe(1);
    expect(reviewChildren[0].problem?.id).toBe(1);
    expect(reviewChildren[0].itemType).toBe("rep");

    const newChildren = await provider.getChildren(newRoot);
    expect(newChildren.length).toBe(1);
    expect(newChildren[0].problem?.id).toBe(3);
    expect(newChildren[0].itemType).toBe("new");

    const doneChildren = await provider.getChildren(doneRoot);
    expect(doneChildren.length).toBe(1);
    expect(doneChildren[0].problem?.id).toBe(2);

    const reviewItem = provider.getTreeItem(reviewChildren[0]);
    expect(reviewItem.label?.toString().includes("Two Sum")).toBeTruthy();
    expect(reviewItem.description).toBe("Due today");

    const newItem = provider.getTreeItem(newChildren[0]);
    expect(newItem.label?.toString().includes("Longest Substring")).toBeTruthy();
    expect(newItem.description).toBe("New problem");

    const doneItem = provider.getTreeItem(doneChildren[0]);
    expect(doneItem.label?.toString().includes("Add Two Numbers")).toBeTruthy();
    expect(doneItem.description).toBe("Completed");
  });

  it("should filter root counts and children when activeCategoryFilter is set", async () => {
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const problems = [
      {
        id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy", category: "Arrays",
        status: "completed" as const, scheduledDate: yesterdayStr, nextRepetitionDate: todayStr,
        repetitionLevel: 1, completionHistory: [
          { date: yesterdayStr + "T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 10, hintsUsed: 0, patternsDetected: [] }
        ]
      },
      {
        id: 2, title: "Longest Substring", slug: "longest-substring", difficulty: "Medium",
        category: "Sliding Window", status: "pending" as const, scheduledDate: todayStr,
        nextRepetitionDate: null, repetitionLevel: 0, completionHistory: []
      }
    ];

    await initState(tmpDir, "Test RoadMap", problems);

    const plansDir = path.join(tmpDir, ".leetplus", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, `${todayStr}.json`), JSON.stringify({
      date: todayStr,
      problems: [{ id: 1, type: "rep" }, { id: 2, type: "new" }]
    }), "utf-8");

    const mockContext = { subscriptions: [], workspaceState: { get: () => undefined, update: () => Promise.resolve() } } as any;
    const provider = new DailyPlanProvider(mockContext);
    provider.activeCategoryFilter = "Arrays";

    const roots = await provider.getChildren();
    const reviewRoot = roots.find(r => r.id === "review")!;
    const newRoot = roots.find(r => r.id === "new")!;

    expect(reviewRoot.label).toBe("Review (1)");
    expect(newRoot.label).toBe("New (0)");

    const reviewChildren = await provider.getChildren(reviewRoot);
    expect(reviewChildren.length).toBe(1);
    expect(reviewChildren[0].problem?.slug).toBe("two-sum");

    const newChildren = await provider.getChildren(newRoot);
    expect(newChildren.length).toBe(0);
  });

  it("should trigger welcome-back flow if inactive for >7 days with completed problems", async () => {
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const problems = [
      {
        id: 1, title: "Two Sum", slug: "two-sum", difficulty: "Easy", category: "Arrays",
        status: "completed" as const, scheduledDate: tenDaysAgo.slice(0, 10),
        nextRepetitionDate: tenDaysAgo.slice(0, 10), repetitionLevel: 1,
        completionHistory: [{ date: tenDaysAgo, rating: 2, notes: "", timeSpentSeconds: 10, hintsUsed: 0, patternsDetected: [] }]
      }
    ];

    const state = await initState(tmpDir, "Test RoadMap", problems);
    state.lastActivityDate = tenDaysAgo;
    await fs.promises.writeFile(
      path.join(tmpDir, ".leetplus", "state.json"), JSON.stringify(state, null, 2), "utf-8"
    );

    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation((msg: string, ...items: any[]) => {
      if (msg.includes("Welcome back!")) return Promise.resolve("Generate AI Recap Plan" as any);
      return Promise.resolve(undefined as any);
    });

    let executedCommand = "";
    let executedPrompt = "";
    vi.spyOn(vscode.commands, "executeCommand").mockImplementation((cmd: string, ...args: any[]) => {
      if (cmd === "leetplus.openChatWithPrompt") {
        executedCommand = cmd;
        executedPrompt = args[0];
      }
      return Promise.resolve();
    });

    const mockContext = { subscriptions: [], workspaceState: { get: () => undefined, update: () => Promise.resolve() } } as any;
    const provider = new DailyPlanProvider(mockContext);
    await provider.getChildren();

      expect(executedCommand).toBe("leetplus.openChatWithPrompt");
    expect(executedPrompt.includes("lp-recap-planner")).toBeTruthy();
    expect(executedPrompt.includes("10 days")).toBeTruthy();
  });

  it("refresh(deleteTodayPlan=true) should delete today's plan file", () => {
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const plansDir = path.join(tmpDir, ".leetplus", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    const planFile = path.join(plansDir, `${todayStr}.json`);
    fs.writeFileSync(planFile, JSON.stringify({ date: todayStr, problems: [] }), "utf-8");

    expect(fs.existsSync(planFile)).toBe(true);

    const mockContext = {
      subscriptions: [],
      workspaceState: { get: () => undefined, update: () => Promise.resolve() }
    } as any;
    const provider = new DailyPlanProvider(mockContext);

    provider.refresh(true);

    expect(fs.existsSync(planFile)).toBe(false);
  });

  it("refresh(deleteTodayPlan=false) should NOT delete today's plan file", () => {
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const plansDir = path.join(tmpDir, ".leetplus", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    const planFile = path.join(plansDir, `${todayStr}.json`);
    fs.writeFileSync(planFile, JSON.stringify({ date: todayStr, problems: [] }), "utf-8");

    const mockContext = {
      subscriptions: [],
      workspaceState: { get: () => undefined, update: () => Promise.resolve() }
    } as any;
    const provider = new DailyPlanProvider(mockContext);

    provider.refresh(); // default: deleteTodayPlan=false

    expect(fs.existsSync(planFile)).toBe(true);
  });
});
