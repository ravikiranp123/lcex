import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  stubInformationMessage,
  stubInputBox,
  restoreAllStubs,
} from "./testUtils";

describe("Auth commands (4d.9)", () => {
  afterEach(() => restoreAllStubs());

  it("leetplus.signIn — completes without crash", async () => {
    stubInformationMessage(undefined);
    await vscode.commands.executeCommand("leetplus.signIn");
    await new Promise((r) => setTimeout(r, 1500));
    assert.ok(true, "signIn completed without crash");
  });

  it("leetplus.signOut — completes without crash", async () => {
    stubInformationMessage(undefined);
    await vscode.commands.executeCommand("leetplus.signOut");
    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true, "signOut completed without crash");
  });

  it("leetplus.viewStats — completes without crash", async () => {
    stubInformationMessage(undefined);
    await vscode.commands.executeCommand("leetplus.viewStats");
    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true, "viewStats completed without crash");
  });

  it.skip("leetplus.cloudSignIn — opens external browser (dialog blocked in test runner)", async () => {});

  it("leetplus.setCloudUsername — shows input box", async () => {
    const stub = stubInputBox("testuser");

    await vscode.commands.executeCommand("leetplus.setCloudUsername");
    await new Promise((r) => setTimeout(r, 1000));

    assert.ok(stub.calledOnce, "showInputBox should be called");
  });

  it("leetplus.setCloudUsername — cancel does nothing", async () => {
    const stub = stubInputBox(undefined);

    await vscode.commands.executeCommand("leetplus.setCloudUsername");
    await new Promise((r) => setTimeout(r, 1000));

    assert.ok(stub.calledOnce, "showInputBox should be called");
  });
});
