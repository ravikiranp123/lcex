import * as fs from "fs";
import * as path from "path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import * as vscode from "vscode";
import { DailyPlanProvider } from "../src/modules/DailyPlanProvider";
import { initState } from "../src/modules/StateManager";

const TEST_DIR = path.join(__dirname, "..", "test-daily-plan-output");

describe("DailyPlanProvider", () => {
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
      const mockContext = { subscriptions: [] } as any;
      const provider = new DailyPlanProvider(mockContext);

      // 3. Get Root Nodes
      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 3);
      
      const reviewRoot = roots.find(r => r.id === "review")!;
      const newRoot = roots.find(r => r.id === "new")!;
      const doneRoot = roots.find(r => r.id === "done")!;

      assert.strictEqual(reviewRoot.label, "Review (1)", "Problem 1 should be under Review");
      assert.strictEqual(newRoot.label, "New (1)", "Problem 3 should be under New");
      assert.strictEqual(doneRoot.label, "Done (1)", "Problem 2 should be under Done since it was completed today");

      // 4. Get Children of Review Root
      const reviewChildren = await provider.getChildren(reviewRoot);
      assert.strictEqual(reviewChildren.length, 1);
      assert.strictEqual(reviewChildren[0].problem?.id, 1);
      assert.strictEqual(reviewChildren[0].itemType, "rep");

      // 5. Get Children of New Root
      const newChildren = await provider.getChildren(newRoot);
      assert.strictEqual(newChildren.length, 1);
      assert.strictEqual(newChildren[0].problem?.id, 3);
      assert.strictEqual(newChildren[0].itemType, "new");

      // 6. Get Children of Done Root
      const doneChildren = await provider.getChildren(doneRoot);
      assert.strictEqual(doneChildren.length, 1);
      assert.strictEqual(doneChildren[0].problem?.id, 2);

      // 7. Verify TreeItem formatting
      const reviewItem = provider.getTreeItem(reviewChildren[0]);
      assert.ok(reviewItem.label?.toString().includes("Two Sum"));
      assert.strictEqual(reviewItem.description, "Due today");

      const newItem = provider.getTreeItem(newChildren[0]);
      assert.ok(newItem.label?.toString().includes("Longest Substring"));
      assert.strictEqual(newItem.description, "New problem");

      const doneItem = provider.getTreeItem(doneChildren[0]);
      assert.ok(doneItem.label?.toString().includes("Add Two Numbers"));
      assert.strictEqual(doneItem.description, "Completed");
    } finally {
      // Restore workspaceFolders
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });
});
