import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import * as vscode from "vscode";
import { DailyPlanProvider } from "../src/modules/DailyPlanProvider";
import { initState } from "../src/modules/StateManager";

const TEST_DIR = path.join(__dirname, "..", "test-daily-plan-output");

describe("DailyPlanProvider", () => {
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

  it("should categorize daily plan items into Review, New, and Done correctly", async () => {
    const workspaceRoot = path.join(TEST_DIR, "workspace1");
    fs.mkdirSync(workspaceRoot, { recursive: true });

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
      // 1. Initialize State with 3 problems:
      // - Problem 1: Completed, but was completed a long time ago. So if scheduled for review, it is not "solved today".
      // - Problem 2: Solved today.
      // - Problem 3: Pending new problem.
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const problems = [
        {
          id: 1,
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "Easy",
          category: "Arrays",
          status: "completed" as const,
          scheduledDate: yesterdayStr,
          nextRepetitionDate: todayStr,
          repetitionLevel: 1,
          completionHistory: [
            {
              date: yesterdayStr + "T10:00:00.000Z",
              rating: 2,
              notes: "",
              timeSpentSeconds: 100,
              hintsUsed: 0,
              patternsDetected: []
            }
          ]
        },
        {
          id: 2,
          title: "Add Two Numbers",
          slug: "add-two-numbers",
          difficulty: "Medium",
          category: "Linked List",
          status: "completed" as const,
          scheduledDate: todayStr,
          nextRepetitionDate: todayStr,
          repetitionLevel: 1,
          completionHistory: [
            {
              date: todayStr + "T14:30:00.000Z", // Solved today!
              rating: 2,
              notes: "",
              timeSpentSeconds: 150,
              hintsUsed: 0,
              patternsDetected: []
            }
          ]
        },
        {
          id: 3,
          title: "Longest Substring Without Repeating Characters",
          slug: "longest-substring",
          difficulty: "Medium",
          category: "Sliding Window",
          status: "pending" as const,
          scheduledDate: todayStr,
          nextRepetitionDate: null,
          repetitionLevel: 0,
          completionHistory: []
        }
      ];

      await initState(workspaceRoot, "Test RoadMap", problems);

      // Create plans directory
      const plansDir = path.join(workspaceRoot, ".leetplus", "plans");
      fs.mkdirSync(plansDir, { recursive: true });

      // Create today's plan containing all three problems:
      // Problem 1 (rep), Problem 2 (rep), Problem 3 (new)
      const todayPlanFile = path.join(plansDir, `${todayStr}.json`);
      const planContent = {
        date: todayStr,
        problems: [
          { id: 1, type: "rep" },
          { id: 2, type: "rep" },
          { id: 3, type: "new" }
        ]
      };
      fs.writeFileSync(todayPlanFile, JSON.stringify(planContent), "utf-8");

      // 2. Initialize provider
      const mockContext = {
        subscriptions: [],
        workspaceState: {
          get: () => undefined,
          update: () => Promise.resolve()
        }
      } as any;
      const provider = new DailyPlanProvider(mockContext);

      // 3. Get Root Nodes
      const roots = await provider.getChildren();
      expect(roots.length).toBe(3);
      
      const reviewRoot = roots.find(r => r.id === "review")!;
      const newRoot = roots.find(r => r.id === "new")!;
      const doneRoot = roots.find(r => r.id === "done")!;

      expect(reviewRoot.label).toBe("Review (1)");
      expect(newRoot.label).toBe("New (1)");
      expect(doneRoot.label).toBe("Done (1)");

      // 4. Get Children of Review Root
      const reviewChildren = await provider.getChildren(reviewRoot);
      expect(reviewChildren.length).toBe(1);
      expect(reviewChildren[0].problem?.id).toBe(1);
      expect(reviewChildren[0].itemType).toBe("rep");

      // 5. Get Children of New Root
      const newChildren = await provider.getChildren(newRoot);
      expect(newChildren.length).toBe(1);
      expect(newChildren[0].problem?.id).toBe(3);
      expect(newChildren[0].itemType).toBe("new");

      // 6. Get Children of Done Root
      const doneChildren = await provider.getChildren(doneRoot);
      expect(doneChildren.length).toBe(1);
      expect(doneChildren[0].problem?.id).toBe(2);

      // 7. Verify TreeItem formatting
      const reviewItem = provider.getTreeItem(reviewChildren[0]);
      expect(reviewItem.label?.toString().includes("Two Sum")).toBeTruthy();
      expect(reviewItem.description).toBe("Due today");

      const newItem = provider.getTreeItem(newChildren[0]);
      expect(newItem.label?.toString().includes("Longest Substring")).toBeTruthy();
      expect(newItem.description).toBe("New problem");

      const doneItem = provider.getTreeItem(doneChildren[0]);
      expect(doneItem.label?.toString().includes("Add Two Numbers")).toBeTruthy();
      expect(doneItem.description).toBe("Completed");
    } finally {
      // Restore workspaceFolders
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });

  it("should filter root counts and children when activeCategoryFilter is set", async () => {
    const workspaceRoot = path.join(TEST_DIR, "workspace2");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: workspaceRoot } as any,
        name: "TestWorkspace",
        index: 0
      }
    ];

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Problems in different categories
      const problems = [
        {
          id: 1,
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "Easy",
          category: "Arrays",
          status: "completed" as const,
          scheduledDate: yesterdayStr,
          nextRepetitionDate: todayStr,
          repetitionLevel: 1,
          completionHistory: [{ date: yesterdayStr + "T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 10, hintsUsed: 0, patternsDetected: [] }]
        },
        {
          id: 2,
          title: "Longest Substring",
          slug: "longest-substring",
          difficulty: "Medium",
          category: "Sliding Window",
          status: "pending" as const,
          scheduledDate: todayStr,
          nextRepetitionDate: null,
          repetitionLevel: 0,
          completionHistory: []
        }
      ];

      await initState(workspaceRoot, "Test RoadMap", problems);

      const plansDir = path.join(workspaceRoot, ".leetplus", "plans");
      fs.mkdirSync(plansDir, { recursive: true });
      const todayPlanFile = path.join(plansDir, `${todayStr}.json`);
      fs.writeFileSync(todayPlanFile, JSON.stringify({
        date: todayStr,
        problems: [
          { id: 1, type: "rep" },
          { id: 2, type: "new" }
        ]
      }), "utf-8");

      const mockContext = {
        subscriptions: [],
        workspaceState: {
          get: () => undefined,
          update: () => Promise.resolve()
        }
      } as any;
      const provider = new DailyPlanProvider(mockContext);
      
      // Set active category filter to Arrays
      provider.activeCategoryFilter = "Arrays";

      const roots = await provider.getChildren();
      const reviewRoot = roots.find(r => r.id === "review")!;
      const newRoot = roots.find(r => r.id === "new")!;

      // Count check: Review has 1 Arrays problem, New has 0 Arrays problems (it is Sliding Window)
      expect(reviewRoot.label).toBe("Review (1)");
      expect(newRoot.label).toBe("New (0)");

      // Check children
      const reviewChildren = await provider.getChildren(reviewRoot);
      expect(reviewChildren.length).toBe(1);
      expect(reviewChildren[0].problem?.slug).toBe("two-sum");

      const newChildren = await provider.getChildren(newRoot);
      expect(newChildren.length).toBe(0);
    } finally {
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });

  it("should trigger welcome-back flow if inactive for >7 days with completed problems", async () => {
    const workspaceRoot = path.join(TEST_DIR, "workspace3");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: workspaceRoot } as any,
        name: "TestWorkspace",
        index: 0
      }
    ];

    try {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const problems = [
        {
          id: 1,
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "Easy",
          category: "Arrays",
          status: "completed" as const,
          scheduledDate: tenDaysAgo.slice(0, 10),
          nextRepetitionDate: tenDaysAgo.slice(0, 10),
          repetitionLevel: 1,
          completionHistory: [{ date: tenDaysAgo, rating: 2, notes: "", timeSpentSeconds: 10, hintsUsed: 0, patternsDetected: [] }]
        }
      ];

      const state = await initState(workspaceRoot, "Test RoadMap", problems);
      state.lastActivityDate = tenDaysAgo;
      await fs.promises.writeFile(
        path.join(workspaceRoot, ".leetplus", "state.json"),
        JSON.stringify(state, null, 2),
        "utf-8"
      );

      // Mock showInformationMessage to click "Generate AI Recap Plan"
      let showInfoCalled = false;
      vscode.window.showInformationMessage = (msg: string, ...items: any[]) => {
        if (msg.includes("Welcome back!")) {
          showInfoCalled = true;
          return Promise.resolve("Generate AI Recap Plan");
        }
        return Promise.resolve(undefined);
      };

      // Mock executeCommand to intercept openChatWithPrompt call
      let executedCommand = "";
      let executedPrompt = "";
      vscode.commands.executeCommand = (cmd: string, ...args: any[]) => {
        if (cmd === "leetplus.openChatWithPrompt") {
          executedCommand = cmd;
          executedPrompt = args[0];
        }
        return Promise.resolve();
      };

      const mockContext = {
        subscriptions: [],
        workspaceState: {
          get: () => undefined,
          update: () => Promise.resolve()
        }
      } as any;

      const provider = new DailyPlanProvider(mockContext);
      await provider.getChildren();

      expect(showInfoCalled).toBe(true);
      expect(executedCommand).toBe("leetplus.openChatWithPrompt");
      expect(executedPrompt.includes("lp-recap-planner")).toBeTruthy();
      expect(executedPrompt.includes("10 days")).toBeTruthy();
    } finally {
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });
});
