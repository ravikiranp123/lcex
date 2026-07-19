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

function getTabViewType(tab: vscode.Tab): string | undefined {
  const input = tab.input as any;
  return input?.viewType;
}

describe("Custom Editors", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-e2e-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if ((tab.input as any)?.uri?.fsPath?.startsWith(tmpDir)) {
          vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }
      }
    }
  });

  it("should open .leetplus/config.json in the config custom editor", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    if (!ext.isActive) {
      await ext.activate();
    }

    const configPath = path.join(getFixtureRoot(), ".leetplus", "config.json");
    assert.ok(fs.existsSync(configPath), "config.json should exist in fixture");

    const uri = vscode.Uri.file(configPath);
    await vscode.commands.executeCommand("vscode.open", uri);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const configTab = allTabs.find((t) => {
      const viewType = getTabViewType(t);
      return viewType === "leetplus.configEditor";
    });

    assert.ok(
      configTab,
      "config.json should open in leetplus.configEditor custom editor"
    );
  });

  it("should open .lcInterview file in the interview custom editor", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    if (!ext.isActive) {
      await ext.activate();
    }

    const interviewContent = JSON.stringify({
      version: 1,
      title: "Test Interview",
      problems: ["two-sum"],
      durationMinutes: 45,
      tags: ["arrays"],
      attempts: [],
    });

    const interviewPath = path.join(tmpDir, "test-interview.lcInterview");
    fs.writeFileSync(interviewPath, interviewContent, "utf-8");

    const uri = vscode.Uri.file(interviewPath);
    await vscode.commands.executeCommand("vscode.open", uri);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const interviewTab = allTabs.find((t) => {
      const viewType = getTabViewType(t);
      return viewType === "leetplus.lcInterviewEditor";
    });

    assert.ok(
      interviewTab,
      ".lcInterview file should open in leetplus.lcInterviewEditor"
    );
  });
});
