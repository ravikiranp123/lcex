import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { readState, initState } from "./StateManager";
import { generateDailyPlan, bootstrapStateFromStudyPlan, loadSeedsFromLocalDataFile, type StudyPlanProblemSeed } from "./DailyPlanGenerator";
import type { LPProblem, LPState } from "./interface/LPState";
import { getEffectiveConfig, resolveDefaultStudyPlanSlug } from "./LeetPlusConfig";
import { archiveStaleReviewSolutionFilesForPlan } from "./ProblemView";


export type DailyPlanItemType = "root" | "problem";

export interface DailyPlanItem {
  type: DailyPlanItemType;
  label: string;
  id?: string;
  problem?: LPProblem;
  itemType?: "rep" | "new";
  collapsibleState?: vscode.TreeItemCollapsibleState;
}

export class DailyPlanTreeItem extends vscode.TreeItem {
  constructor(
    public readonly data: DailyPlanItem,
    solvedToday: boolean = false
  ) {
    super(
      data.label,
      data.type === "root"
        ? (data.collapsibleState ?? vscode.TreeItemCollapsibleState.Expanded)
        : vscode.TreeItemCollapsibleState.None
    );

    this.id = data.id;

    if (data.type === "root") {
      this.contextValue = "root";
      if (data.id === "review") {
        this.iconPath = new vscode.ThemeIcon("history", new vscode.ThemeColor("charts.orange"));
      } else if (data.id === "new") {
        this.iconPath = new vscode.ThemeIcon("git-pull-request-create", new vscode.ThemeColor("charts.blue"));
      } else if (data.id === "done") {
        this.iconPath = new vscode.ThemeIcon("pass", new vscode.ThemeColor("testing.iconPassed"));
      }
    } else if (data.type === "problem" && data.problem) {
      const p = data.problem;
      this.contextValue = "problem";
      this.tooltip = `${p.id}. ${p.title} (${p.difficulty})`;
      
      const difficultyEmoji = p.difficulty === "Easy" ? "🟢" : p.difficulty === "Medium" ? "🟡" : "🔴";
      const numId = typeof p.id === "number" ? p.id : parseInt(String(p.id), 10);
      const nameLabel = !isNaN(numId) ? `${numId}. ${p.title}` : p.title;
      this.label = `${difficultyEmoji} ${nameLabel}`;

      if (solvedToday) {
        this.description = "Completed";
        this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
      } else {
        if (data.itemType === "rep") {
          const isUrgent = p.completionHistory && p.completionHistory.length > 0 && p.completionHistory[p.completionHistory.length - 1].rating === 4;
          this.description = isUrgent ? "Again (urgent)" : "Due today";
          this.iconPath = new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("charts.orange"));
        } else {
          this.description = "New problem";
          this.iconPath = new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("charts.blue"));
        }
      }

      this.command = {
        command: "leetplus.showDailyPlanProblem",
        title: "Open Problem",
        arguments: [
          {
            id: p.id,
            titleSlug: p.slug,
            title: p.title,
            difficulty: p.difficulty,
          }
        ]
      };
    }
  }
}

export class DailyPlanProvider implements vscode.TreeDataProvider<DailyPlanItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DailyPlanItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private mismatchNotificationShown = false;
  private welcomeBackShown = false;
  public activeCategoryFilter: string | undefined = undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    /**
     * Optional callback to fetch problems from the active study plan.
     * When provided, DailyPlanProvider will auto-seed state.json if the
     * problems list is empty (first-time / clean-state scenario).
     */
    private readonly fetchStudyPlanProblems?: () => Promise<StudyPlanProblemSeed[]>
  ) {}

  public async getCurrentState(): Promise<LPState | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    const workspaceRoot = folders[0].uri.fsPath;
    try {
      return await readState(workspaceRoot);
    } catch {
      return null;
    }
  }

  refresh(deleteTodayPlan = false): void {
    if (deleteTodayPlan) {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        const workspaceRoot = folders[0].uri.fsPath;
        const todayStr = new Date().toISOString().slice(0, 10);
        const planFile = path.join(workspaceRoot, ".leetplus", "plans", `${todayStr}.json`);
        try {
          if (fs.existsSync(planFile)) {
            fs.unlinkSync(planFile);
          }
        } catch {
          // best-effort
        }
      }
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DailyPlanItem): vscode.TreeItem {
    const solvedToday = element.problem ? this.isSolvedToday(element.problem) : false;
    return new DailyPlanTreeItem(element, solvedToday);
  }

  async getChildren(element?: DailyPlanItem): Promise<DailyPlanItem[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return [];
    }
    const workspaceRoot = folders[0].uri.fsPath;

    const config = getEffectiveConfig(folders);
    const studyPlans = config.studyPlans ?? [];
    let workspaceStudySlug = this.context.workspaceState.get<string>("leetplus.selectedStudyPlan")?.trim();
    if (config.activeStudyPlan && config.activeStudyPlan !== workspaceStudySlug && studyPlans.some((p) => p.slug === config.activeStudyPlan)) {
      await this.context.workspaceState.update("leetplus.selectedStudyPlan", config.activeStudyPlan);
      workspaceStudySlug = config.activeStudyPlan;
    }
    const savedStudySlug =
      workspaceStudySlug && studyPlans.some((p) => p.slug === workspaceStudySlug)
        ? workspaceStudySlug
        : resolveDefaultStudyPlanSlug(studyPlans, config.activeStudyPlan);

    // Load state (or initialize a blank one if missing)
    let state: LPState | null = await readState(workspaceRoot);
    if (!state) {
      const activePlan = studyPlans.find((p) => p.slug === savedStudySlug);
      const planName = activePlan?.name ?? "Default";
      const planSlug = activePlan?.slug ?? savedStudySlug;

      // Initialize a blank state with the resolved plan info so bootstrapping gets the correct metadata
      state = await initState(workspaceRoot, planName, [], planSlug);
    } else if (state.planSlug && state.planSlug !== savedStudySlug && !this.mismatchNotificationShown) {
      // Check for config vs state active plan mismatch
      this.mismatchNotificationShown = true;
      const targetPlan = studyPlans.find((p) => p.slug === savedStudySlug);
      const targetName = targetPlan?.name ?? savedStudySlug;
      void vscode.window.showWarningMessage(
        `LeetPlus: The study plan in your workspace configuration ("${targetName}") does not match your active Daily Plan session ("${state.planName}").`,
        "Switch Session Plan",
        "Ignore"
      ).then((choice) => {
        if (choice === "Switch Session Plan") {
          void vscode.commands.executeCommand("leetplus.switchStudyPlan", savedStudySlug);
        }
      });
    }

    if (state && !this.welcomeBackShown) {
      this.welcomeBackShown = true;
      const lastActivityStr = state.lastActivityDate;
      if (lastActivityStr) {
        const lastActivity = new Date(lastActivityStr);
        const completedProblems = state.problems.filter((p) => p.status === "completed");
        if (completedProblems.length > 0) {
          const diffMs = Date.now() - lastActivity.getTime();
          const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          if (diffDays > 7) {
            void this.triggerWelcomeBackFlow(state, diffDays);
          }
        }
      }
    }


    // Bootstrap state from study plan if the problem list is empty.
    // Priority: local data file (configured path or .leetplus/data/<planSlug>.json) → API callback.
    if (state.problems.length === 0) {
       try {
        const config = getEffectiveConfig(folders);
        const planSlug = state.planSlug ?? state.planName.toLowerCase().replace(/\s+/g, "-");
        const configuredPlan = config.studyPlans?.find((p) => p.slug === planSlug);
        const localPath = configuredPlan?.path;

        // 1. Try local data file first (works offline, instant)
        const localSeeds = loadSeedsFromLocalDataFile(workspaceRoot, planSlug, localPath);
        let fetchFn: (() => Promise<StudyPlanProblemSeed[]>) | undefined;
        if (localSeeds) {
          fetchFn = async () => localSeeds;
        } else if (this.fetchStudyPlanProblems) {
          // 2. Fall back to LeetCode API
          fetchFn = this.fetchStudyPlanProblems;
        }

        if (fetchFn) {
          const added = await bootstrapStateFromStudyPlan(workspaceRoot, state, fetchFn);
          if (added > 0) {
            void vscode.window.showInformationMessage(
              `LeetPlus: Seeded ${added} problems from your study plan into state.json.`
            );
          }
        }
      } catch {
        // Bootstrap is best-effort; proceed with empty state
      }
    }



    // Load plan
    const todayStr = new Date().toISOString().slice(0, 10);
    const planFile = path.join(workspaceRoot, ".leetplus", "plans", `${todayStr}.json`);
    
    let planProblems: Array<{ id: number; type: "rep" | "new" }> = [];
    if (fs.existsSync(planFile)) {
      try {
        const raw = fs.readFileSync(planFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.problems)) {
          planProblems = parsed.problems;
        }
      } catch {
        // Ignore parse errors
      }
    } else {
      try {
        const generated = await generateDailyPlan(workspaceRoot, state, this.activeCategoryFilter);
        planProblems = generated.problems;
        // Auto-archive stale review solution files whenever a new plan is generated,
        // preserving previous attempts before the review problems are opened today.
        try {
          await archiveStaleReviewSolutionFilesForPlan(this.context, state, generated.problems);
        } catch {
          // Best-effort — never break the tree view.
        }
      } catch {
        // Fallback
      }
    }

    if (!element) {
      // Root nodes: Review, New, Done
      let reviewCount = 0;
      let newCount = 0;
      let doneCount = 0;

      for (const item of planProblems) {
        const prob = state.problems.find(p => p.id === item.id);
        if (!prob) continue;

        // Apply category filter
        if (this.activeCategoryFilter && prob.category !== this.activeCategoryFilter) {
          continue;
        }

        if (this.isSolvedToday(prob)) {
          doneCount++;
        } else if (item.type === "rep") {
          reviewCount++;
        } else {
          newCount++;
        }
      }

      return [
        { type: "root", label: `Review (${reviewCount})`, id: "review" },
        { type: "root", label: `New (${newCount})`, id: "new" },
        { type: "root", label: `Done (${doneCount})`, id: "done" }
      ];
    }

    // Child nodes
    const children: DailyPlanItem[] = [];
    for (const item of planProblems) {
      const prob = state.problems.find(p => p.id === item.id);
      if (!prob) continue;

      // Apply category filter
      if (this.activeCategoryFilter && prob.category !== this.activeCategoryFilter) {
        continue;
      }

      const solvedToday = this.isSolvedToday(prob);
      if (element.id === "done" && solvedToday) {
        children.push({
          type: "problem",
          label: `${prob.id}. ${prob.title}`,
          problem: prob,
          itemType: item.type
        });
      } else if (element.id === "review" && !solvedToday && item.type === "rep") {
        children.push({
          type: "problem",
          label: `${prob.id}. ${prob.title}`,
          problem: prob,
          itemType: item.type
        });
      } else if (element.id === "new" && !solvedToday && item.type === "new") {
        children.push({
          type: "problem",
          label: `${prob.id}. ${prob.title}`,
          problem: prob,
          itemType: item.type
        });
      }
    }

    return children;
  }

  private async triggerWelcomeBackFlow(state: LPState, diffDays: number): Promise<void> {
    const confirm = await vscode.window.showInformationMessage(
      `Welcome back! It's been ${diffDays} days since your last LeetPlus practice. Let's trigger a personalized AI recap plan to ease you back into coding.`,
      "Generate AI Recap Plan",
      "Cancel"
    );

    if (confirm !== "Generate AI Recap Plan") return;

    // Collect lowest mastery patterns
    const mastery = state.patternMastery || {};
    const lowestPatterns = Object.entries(mastery)
      .map(([pattern, score]) => ({ pattern, score }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    // Collect overdue reviews
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueSlugs = state.problems
      .filter((p) => p.status === "completed" && p.nextRepetitionDate && p.nextRepetitionDate.slice(0, 10) <= todayStr)
      .map((p) => p.slug)
      .filter(Boolean) as string[];

    const completedSlugs = state.problems
      .filter((p) => p.status === "completed")
      .map((p) => p.slug)
      .filter(Boolean) as string[];

    const dateStr = new Date().toISOString().slice(0, 10);

    const prompt = `Load **lp-recap-planner** and follow its instructions to generate a comeback recap plan.
Here is the context about my progress:
- Days Inactive: ${diffDays} days
- Last Activity Date: ${state.lastActivityDate}
- Decayed/Weak Patterns: ${JSON.stringify(lowestPatterns)}
- Overdue Review Problems: ${JSON.stringify(overdueSlugs)}
- Completed Problems: ${JSON.stringify(completedSlugs)}

Please generate the study plan JSON and write it to \".leetplus/plans/ai-recap-${dateStr}.json\" in my workspace. Then register it in \".leetplus/config.json\" under \"studyPlans\" (slug: \"ai-recap-${dateStr}\", name: \"AI Recap Plan ${new Date().toLocaleDateString()}\", path: \".leetplus/plans/ai-recap-${dateStr}.json\") and set it as the \"activeStudyPlan\" to active it.`;

    await vscode.commands.executeCommand("leetplus.openChatWithPrompt", prompt);
  }

  private isSolvedToday(problem: LPProblem): boolean {
    if (!problem.completionHistory || problem.completionHistory.length === 0) {
      return false;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    return problem.completionHistory.some(history => history.date.startsWith(todayStr));
  }
}
