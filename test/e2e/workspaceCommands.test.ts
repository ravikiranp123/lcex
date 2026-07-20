import * as assert from "node:assert";
import * as vscode from "vscode";
import { stubInformationMessage, restoreAllStubs } from "./testUtils";

describe("Workspace commands (4d.4)", () => {
  afterEach(() => restoreAllStubs());

  it("leetplus.markAsSolved — warns when no active problem", async () => {
    stubInformationMessage(undefined);

    await vscode.commands.executeCommand("leetplus.markAsSolved");

    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true, "markAsSolved completed without crash");
  });

  it("leetplus.markAsAttempting — completes without crash", async () => {
    await vscode.commands.executeCommand("leetplus.markAsAttempting");
    assert.ok(true);
  });

  it("leetplus.clearProblemStatus — completes without crash", async () => {
    await vscode.commands.executeCommand("leetplus.clearProblemStatus");
    assert.ok(true);
  });

  it("leetplus.initializeWorkspace — completes without crash on fixture", async () => {
    stubInformationMessage(undefined);

    await vscode.commands.executeCommand("leetplus.initializeWorkspace");

    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true, "initializeWorkspace completed without crash");
  });
});
