import * as assert from "node:assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  stubQuickPick,
  stubInformationMessage,
  restoreAllStubs,
} from "./testUtils";

describe("Command Execution — switchStudyPlan", () => {
  afterEach(() => {
    restoreAllStubs();
  });

  it("should show quickPick when no targetPlanSlug is provided", async () => {
    const quickPickSpy = stubQuickPick(undefined);

    await vscode.commands.executeCommand("leetplus.switchStudyPlan");

    assert.ok(
      quickPickSpy.calledOnce,
      "showQuickPick should be called when no slug argument is provided"
    );

    const items = quickPickSpy.firstCall.args[0] as Array<{
      label: string;
      slug: string;
    }>;
    assert.ok(Array.isArray(items), "QuickPick should receive an array of plans");
    assert.ok(items.length > 0, "Should have at least one study plan option");
  });

  it("should skip quickPick when targetPlanSlug matches a configured plan", async () => {
    const quickPickSpy = stubQuickPick(undefined);

    try {
      await vscode.commands.executeCommand(
        "leetplus.switchStudyPlan",
        "top-interview-150"
      );
    } catch {
      // Network errors are expected in test env
    }

    assert.strictEqual(
      quickPickSpy.callCount,
      0,
      "showQuickPick should NOT be called when a valid targetPlanSlug is provided"
    );
  });

  it("should show quickPick when targetPlanSlug does not match any plan", async () => {
    const quickPickSpy = stubQuickPick(undefined);

    await vscode.commands.executeCommand(
      "leetplus.switchStudyPlan",
      "nonexistent-plan-slug"
    );

    assert.ok(
      quickPickSpy.calledOnce,
      "showQuickPick should be called when targetPlanSlug doesn't match"
    );
  });
});
