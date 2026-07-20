import * as assert from "node:assert";
import * as vscode from "vscode";

const ALL_COMMANDS = [
  "leetplus.openProblem",
  "leetplus.completeProblem",
  "leetplus.openSolutionFromText",
  "leetplus.openQotd",
  "leetplus.runExamples",
  "leetplus.openNextBugReview",
  "leetplus.fuzzVsBruteForce",
  "leetplus.measureComplexity",
  "leetplus.visualizeRecursion",
  "leetplus.visualizeIterative",
  "leetplus.clearInlineDecorations",
  "leetplus.runAdversarialTests",
  "leetplus.complexityBudget",
  "leetplus.lint",
  "leetplus.toggleLint",
  "leetplus.toggleComplexityBudget",
  "leetplus.toggleAdversarialTests",
  "leetplus.toggleRunExamplesOnSave",
  "leetplus.toggleInlineDecorations",
  "leetplus.runInTerminal",
  "leetplus.signIn",
  "leetplus.signOut",
  "leetplus.refreshProblems",
  "leetplus.refreshQotd",
  "leetplus.refreshContests",
  "leetplus.openContestOnWeb",
  "leetplus.refreshCompanies",
  "leetplus.searchCompanies",
  "leetplus.filterCompaniesByDifficulty",
  "leetplus.markAsSolved",
  "leetplus.markAsAttempting",
  "leetplus.clearProblemStatus",
  "leetplus.filterByDifficulty",
  "leetplus.searchProblems",
  "leetplus.openRandomProblem",
  "leetplus.patternDrill",
  "leetplus.practicePattern",
  "leetplus.showPatternMasterySummary",
  "leetplus.viewStats",
  "leetplus.refreshStatsData",
  "leetplus.cloudSignIn",
  "leetplus.cloudSignOut",
  "leetplus.setCloudUsername",
  "leetplus.pushCloudStats",
  "leetplus.pullCloudStats",
  "leetplus.applyTheme",
  "leetplus.switchStudyPlan",
  "leetplus.switchProblemList",
  "leetplus.agentMakeRunnable",
  "leetplus.agentHint",
  "leetplus.agentAnalyze",
  "leetplus.openHintAnalysis",
  "leetplus.agentExplainCode",
  "leetplus.focusModeEnter",
  "leetplus.focusModeExit",
  "leetplus.setDailyGoal",
  "leetplus.initializeWorkspace",
  "leetplus.interviewModeStart",
  "leetplus.interviewModeStop",
  "leetplus.interviewGenerateWithAi",
  "leetplus.openLcInterviewReportFile",
  "leetplus.toggleAnalytics",
  "leetplus.showDailyPlan",
  "leetplus.toggleDiffLogger",
  "leetplus.switchDailyPlanMode",
  "leetplus.filterDailyPlanByCategory",
];

describe("All commands registered", () => {
  let registeredCommands: string[];

  before(async () => {
    registeredCommands = await vscode.commands.getCommands(true);
  });

  it("should have all 66 commands registered", () => {
    for (const cmd of ALL_COMMANDS) {
      assert.ok(
        registeredCommands.includes(cmd),
        `Command "${cmd}" is not registered`
      );
    }
  });
});
