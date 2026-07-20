import * as assert from "node:assert";
import * as vscode from "vscode";

describe("Runner commands (4d.7)", () => {
  const TOGGLE_COMMANDS = [
    "leetplus.toggleInlineDecorations",
    "leetplus.clearInlineDecorations",
    "leetplus.toggleLint",
    "leetplus.toggleComplexityBudget",
    "leetplus.toggleAdversarialTests",
    "leetplus.toggleRunExamplesOnSave",
  ];

  for (const cmd of TOGGLE_COMMANDS) {
    it(`${cmd} — completes without crash`, async () => {
      await vscode.commands.executeCommand(cmd);
      assert.ok(true);
    });
  }

  it("leetplus.runExamples — completes (no editor → graceful)", async () => {
    await vscode.commands.executeCommand("leetplus.runExamples");
    await new Promise((r) => setTimeout(r, 500));
    assert.ok(true);
  });

  it("leetplus.runInTerminal — completes without crash", async () => {
    await vscode.commands.executeCommand("leetplus.runInTerminal");
    await new Promise((r) => setTimeout(r, 500));
    assert.ok(true);
  });

  it("leetplus.openNextBugReview — completes without crash", async () => {
    await vscode.commands.executeCommand("leetplus.openNextBugReview");
    await new Promise((r) => setTimeout(r, 500));
    assert.ok(true);
  });
});
