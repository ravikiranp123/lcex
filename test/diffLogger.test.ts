import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { initDiffLogger, saveDiff } from "../src/modules/DiffLogger";
import { initState, readState } from "../src/modules/StateManager";

const TEST_DIR = path.join(__dirname, "..", "test-diff-output");

describe("DiffLogger", () => {
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

  it("should generate a patch unified diff successfully", async () => {
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
          id: 42,
          title: "Trapping Rain Water",
          slug: "trapping-rain-water",
          difficulty: "Hard",
          category: "Arrays",
          status: "pending" as const,
          scheduledDate: new Date().toISOString(),
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

      // Create configuration file config.json with custom diffLogger settings
      const configJson = {
        diffLogger: {
          enabled: true,
          triggerMode: "smart",
          debounceMs: 50,
          charThreshold: 20,
          trackedExtensions: [".ts"]
        }
      };
      fs.writeFileSync(path.join(leetplusDir, "config.json"), JSON.stringify(configJson), "utf-8");

      // 2. Initialize DiffLogger
      const subscriptions: any[] = [];
      const context = { subscriptions } as any;
      initDiffLogger(context);

      // 3. Simulate document changes
      const docPath = path.join(workspaceRoot, "42.ts");
      const docUri = { fsPath: docPath };
      
      let docText = "function trap(height: number[]): number {\n  return 0;\n}";
      const getDoc = () => ({
        uri: docUri,
        fileName: docPath,
        getText: () => docText
      });

      // Fire initial document update to cache baseline
      const mockEventInit = {
        document: getDoc(),
        contentChanges: []
      } as any;
      
      await vscode._fireDidChangeTextDocument(mockEventInit);

      // Verify that no diff is generated on first load (since it just initializes the baseline)
      const diffsDir = path.join(workspaceRoot, ".leetplus", "diffs", "trapping-rain-water");
      expect(fs.existsSync(diffsDir)).toBe(false);

      // Simulate a small change (< threshold = 20 characters)
      docText = "function trap(height: number[]): number {\n  return 1;\n}";
      const mockEventSmall = {
        document: getDoc(),
        contentChanges: [{ text: "1", rangeLength: 1 }]
      } as any;
      await vscode._fireDidChangeTextDocument(mockEventSmall);

      // Verify no diff created immediately because it's below character threshold (20) and timer hasn't fired
      expect(fs.existsSync(diffsDir)).toBe(false);

      // Wait 100ms for time-based debounce trigger to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify diff patch file was created by the time trigger
      expect(fs.existsSync(diffsDir)).toBeTruthy();
      let files = fs.readdirSync(diffsDir);
      expect(files.length).toBe(1);
      expect(files[0].endsWith(".patch")).toBeTruthy();

      const patchContent = fs.readFileSync(path.join(diffsDir, files[0]), "utf-8");
      expect(patchContent.includes("-  return 0;")).toBeTruthy();
      expect(patchContent.includes("+  return 1;")).toBeTruthy();

      // Simulate a large change (> threshold = 20 characters) to trigger immediate change-based save
      docText = "function trap(height: number[]): number {\n  // Let's write more code to exceed character threshold of twenty characters\n  return 2;\n}";
      const mockEventLarge = {
        document: getDoc(),
        contentChanges: [{ text: "// Let's write more code to exceed character threshold of twenty characters\n  return 2;", rangeLength: 10 }]
      } as any;
      await vscode._fireDidChangeTextDocument(mockEventLarge);

      // Verify diff was created immediately without waiting for timeout
      files = fs.readdirSync(diffsDir);
      expect(files.length).toBe(2);
    } finally {
      // Restore original workspace folders
      vscode.workspace.workspaceFolders = originalWorkspaceFolders;
      vscode._clearChangeListeners();
    }
  });
});
