import * as assert from "node:assert";
import * as vscode from "vscode";
import { stubInformationMessage, restoreAllStubs } from "./testUtils";

describe("Interview commands (4d.6)", () => {
  afterEach(() => restoreAllStubs());

  it("leetplus.interviewModeStop — completes when no active session", async () => {
    stubInformationMessage(undefined);

    await vscode.commands.executeCommand("leetplus.interviewModeStop");

    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true, "interviewModeStop completed without crash");
  });

  it.skip("leetplus.openLcInterviewReportFile — opens native OS file dialog (cannot stub)", async () => {});

  it.skip("leetplus.interviewGenerateWithAi — opens copilot chat panel (cannot stub)", async () => {});
});
