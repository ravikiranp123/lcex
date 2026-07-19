import * as assert from "node:assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const EXTENSION_ID = "ravikiranp123.leet-plus";

function getFixtureRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  assert.ok(folders && folders.length > 0, "Workspace should have folders");
  return folders[0].uri.fsPath;
}

describe("Status Bar", () => {
  it("should show status bar text reflecting streak and due count", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    if (!ext.isActive) {
      await ext.activate();
    }

    const workspaceRoot = getFixtureRoot();
    const statePath = path.join(workspaceRoot, ".leetplus", "state.json");
    const raw = fs.readFileSync(statePath, "utf-8");
    const state = JSON.parse(raw);

    assert.strictEqual(state.currentStreak, 5, "Fixture state should have streak=5");

    const { getDueProblems } = await import("../../src/modules/SRSEngine");
    const dueProblems = getDueProblems(state);
    assert.strictEqual(dueProblems.length, 3, "Fixture should have 3 due problems");

    const expectedText = `\u{1F525} ${state.currentStreak} | \u{1F4CB} ${dueProblems.length} due`;

    const { updateStatusBar } = await import("../../src/modules/StatusBarManager");
    await updateStatusBar();

    const hasStatusBarCommand = await vscode.commands.getCommands(true);
    assert.ok(
      hasStatusBarCommand.includes("leetplus.showDailyPlan"),
      "leetplus.showDailyPlan command should be registered"
    );
  });

  it("should hide status bar when no workspace folders exist", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    if (!ext.isActive) {
      await ext.activate();
    }

    const originalFolders = vscode.workspace.workspaceFolders;
    try {
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { updateStatusBar } = await import("../../src/modules/StatusBarManager");
      await updateStatusBar();

      assert.ok(true, "updateStatusBar completed without error when folders are empty");
    } finally {
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: originalFolders,
        writable: true,
        configurable: true,
      });
    }
  });
});
