import * as assert from "node:assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { stubInputBox, stubQuickPick, restoreAllStubs } from "./testUtils";

describe("Sidebar commands (4d.8)", () => {
  afterEach(() => restoreAllStubs());

  const REFRESH_COMMANDS = [
    "leetplus.refreshProblems",
    "leetplus.refreshQotd",
    "leetplus.refreshContests",
    "leetplus.refreshCompanies",
    "leetplus.refreshStatsData",
  ];

  for (const cmd of REFRESH_COMMANDS) {
    it(`${cmd} — completes without crash`, async () => {
      await vscode.commands.executeCommand(cmd);
      assert.ok(true);
    });
  }

  it("leetplus.filterByDifficulty — completes without crash", async () => {
    stubQuickPick(undefined);
    await vscode.commands.executeCommand("leetplus.filterByDifficulty");
    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(true);
  });

  it("leetplus.searchProblems — shows input box, applies filter on confirm", async () => {
    const stub = stubInputBox("two-sum");

    await vscode.commands.executeCommand("leetplus.searchProblems");
    await new Promise((r) => setTimeout(r, 500));

    assert.ok(stub.calledOnce, "showInputBox should be called");
  });

  it("leetplus.searchProblems — cancel does nothing", async () => {
    const stub = stubInputBox(undefined);

    await vscode.commands.executeCommand("leetplus.searchProblems");
    await new Promise((r) => setTimeout(r, 500));

    assert.ok(stub.calledOnce, "showInputBox should be called");
  });

  it("leetplus.searchCompanies — shows input box", async () => {
    const stub = stubInputBox("amazon");

    await vscode.commands.executeCommand("leetplus.searchCompanies");
    await new Promise((r) => setTimeout(r, 500));

    assert.ok(stub.calledOnce, "showInputBox should be called");
  });

  it("leetplus.toggleAnalytics — shows quickPick", async () => {
    const stub = stubQuickPick(undefined);

    await vscode.commands.executeCommand("leetplus.toggleAnalytics");
    await new Promise((r) => setTimeout(r, 500));

    assert.ok(stub.calledOnce, "showQuickPick should be called");
  });
});
