import * as assert from "node:assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { stubQuickPick, restoreAllStubs } from "./testUtils";

describe("Command Execution — interviewModeStart", () => {
  afterEach(() => {
    restoreAllStubs();
  });

  it("should do nothing when quickPick is cancelled", async () => {
    const quickPickSpy = stubQuickPick(undefined);

    await vscode.commands.executeCommand("leetplus.interviewModeStart");

    assert.strictEqual(
      quickPickSpy.callCount,
      1,
      "showQuickPick should be called once"
    );
  });

  it("should delegate to interviewGenerateWithAi when 'ai' option is selected", async () => {
    stubQuickPick({ label: "Generate interview with AI", id: "ai" } as any);

    const executeSpy = sinon.spy(vscode.commands, "executeCommand");

    try {
      const promise = vscode.commands.executeCommand(
        "leetplus.interviewModeStart"
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      const aiCall = executeSpy
        .getCalls()
        .find((c) => c.args[0] === "leetplus.interviewGenerateWithAi");
      assert.ok(
        aiCall,
        "Should execute leetplus.interviewGenerateWithAi when 'ai' is selected"
      );
    } finally {
      executeSpy.restore();
    }
  });

  it("should open interview setup webview when 'panel' option is selected", async () => {
    stubQuickPick({ label: "Interview setup panel", id: "panel" } as any);

    const createWebviewSpy = sinon.spy(
      vscode.window,
      "createWebviewPanel"
    );

    try {
      await vscode.commands.executeCommand("leetplus.interviewModeStart");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      assert.ok(
        createWebviewSpy.called,
        "createWebviewPanel should be called to open the interview setup panel"
      );
    } finally {
      createWebviewSpy.restore();
    }
  });
});
