import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  stubQuickPick,
  stubInformationMessage,
  restoreAllStubs,
} from "./testUtils";

describe("Misc commands (4d.10)", () => {
  afterEach(() => restoreAllStubs());

  it("leetplus.toggleDiffLogger — completes without crash", async () => {
    await vscode.commands.executeCommand("leetplus.toggleDiffLogger");
    assert.ok(true);
  });

  it("leetplus.setDailyGoal — completes without crash", async () => {
    stubQuickPick(undefined);
    await vscode.commands.executeCommand("leetplus.setDailyGoal");
    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true);
  });

  it("leetplus.applyTheme — completes without crash", async () => {
    stubQuickPick(undefined);
    await vscode.commands.executeCommand("leetplus.applyTheme");
    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true);
  });

  it("leetplus.openChatWithPrompt — completes without crash", async () => {
    stubInformationMessage(undefined);
    await vscode.commands.executeCommand(
      "leetplus.openChatWithPrompt",
      "test-prompt"
    );
    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true);
  });
});
