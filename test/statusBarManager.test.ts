import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { initStatusBar, updateStatusBar } from "../src/modules/StatusBarManager";
import { initState } from "../src/modules/StateManager";

const TEST_DIR = path.join(__dirname, "..", "test-statusbar-output");

describe("StatusBarManager", () => {
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

  it("should update status bar item text based on state", async () => {
    const workspaceRoot = path.join(TEST_DIR, "workspace1");
    fs.mkdirSync(workspaceRoot, { recursive: true });

    // Mock VS Code workspace folder API to return our test workspace
    const vscode = require("vscode");
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspaceRoot } }];

    try {
      // 1. Initialize State
      const problems = [
        {
          id: 1,
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "Easy",
          category: "Arrays",
          status: "pending" as const,
          scheduledDate: new Date(Date.now() - 3600 * 1000).toISOString(), // Overdue
          nextRepetitionDate: null,
          repetitionLevel: 0,
          completionHistory: [],
          patterns: [],
          leetcodeUrl: null,
          youtubeId: null,
          solutionLink: null,
          hints: null,
          solution: null,
        },
      ];
      await initState(workspaceRoot, "NeetCode 150", problems);

      // Create .leetplus folder to make it recognized as a LeetPlus workspace
      const leetplusDir = path.join(workspaceRoot, ".leetplus");
      if (!fs.existsSync(leetplusDir)) {
        fs.mkdirSync(leetplusDir, { recursive: true });
      }

      // 2. Initialize Status Bar
      const subscriptions: any[] = [];
      const context = { subscriptions } as any;
      initStatusBar(context);

      // Verify command registration
      expect(subscriptions.length).toBe(4); // 1 item + 1 command + 1 watcher + 1 workspace change listener

      // 3. Update Status Bar
      await updateStatusBar();

      // Retrieve the status bar item created during initStatusBar (stored in mock's _statusBarItems array)
      const mockItem = (vscode as any)._statusBarItems[0];
      expect(mockItem.text).toBe("🔥 0 | 📋 1 due");
    } finally {
      // Restore original workspace folders
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
    }
  });
});
