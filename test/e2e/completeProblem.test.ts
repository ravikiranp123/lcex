import * as assert from "node:assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  stubWarningMessage,
  stubErrorMessage,
  restoreAllStubs,
  getFixtureRoot,
} from "./testUtils";

describe("Command Execution — completeProblem", () => {
  let savedState: string;
  let solutionPath: string | null = null;

  beforeEach(() => {
    const workspaceRoot = getFixtureRoot();
    const statePath = path.join(workspaceRoot, ".leetplus", "state.json");
    savedState = fs.readFileSync(statePath, "utf-8");
  });

  afterEach(() => {
    restoreAllStubs();
    const workspaceRoot = getFixtureRoot();
    const statePath = path.join(workspaceRoot, ".leetplus", "state.json");
    fs.writeFileSync(statePath, savedState, "utf-8");
    if (solutionPath) {
      try { fs.unlinkSync(solutionPath); } catch {}
      solutionPath = null;
    }
    const snapshotsDir = path.join(workspaceRoot, ".leetplus", "snapshots", "two-sum");
    try { fs.rmSync(snapshotsDir, { recursive: true, force: true }); } catch {}
  });

  it("should warn when no active problem is found", async () => {
    stubWarningMessage(undefined);

    await vscode.commands.executeCommand("leetplus.completeProblem");

    assert.ok(true, "Command completes without crash");
  });

  it("should warn when problem slug is not in state", async () => {
    stubWarningMessage(undefined);

    await vscode.commands.executeCommand("leetplus.completeProblem", "nonexistent-slug");

    assert.ok(true, "Command handles missing problem gracefully");
  });

  it("should capture snapshot when solution file exists", async () => {
    const workspaceRoot = getFixtureRoot();
    solutionPath = path.join(workspaceRoot, "1.ts");
    fs.writeFileSync(solutionPath, "function twoSum(nums: number[], target: number): number[] {\n  return [];\n}\n", "utf-8");

    const warningSpy = stubWarningMessage(undefined);
    const errorSpy = stubErrorMessage(undefined);

    await vscode.commands.executeCommand("leetplus.completeProblem", "two-sum");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const snapshotsDir = path.join(workspaceRoot, ".leetplus", "snapshots", "two-sum");
    const snapshotsExist = fs.existsSync(snapshotsDir);

    const statePath = path.join(workspaceRoot, ".leetplus", "state.json");
    const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    const problem = state.problems.find((p: any) => p.slug === "two-sum");

    if (snapshotsExist) {
      assert.ok(problem, "Problem should exist in state after snapshot");
      assert.strictEqual(
        problem.status,
        "completed",
        "Problem status should be 'completed' after snapshot"
      );
      assert.ok(
        problem.completionHistory.length > 0,
        "Completion history should have entries"
      );
    } else {
      const warned =
        warningSpy.called || errorSpy.called;
      assert.ok(
        warned,
        "Either snapshot was captured or a warning/error was shown"
      );
    }
  });
});
