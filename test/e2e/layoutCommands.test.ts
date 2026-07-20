import * as assert from "node:assert";
import * as vscode from "vscode";

describe("Layout commands (4d.2)", () => {
  it("leetplus.focusModeExit — completes without crash", async () => {
    await vscode.commands.executeCommand("leetplus.focusModeExit");
    assert.ok(true);
  });

  it("leetplus.focusModeEnter — completes without crash", async () => {
    await vscode.commands.executeCommand("leetplus.focusModeEnter");
    assert.ok(true);
  });
});
