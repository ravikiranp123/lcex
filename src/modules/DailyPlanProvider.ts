import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { readState, initState } from "./StateManager";
import { generateDailyPlan, bootstrapStateFromStudyPlan, loadSeedsFromLocalDataFile, type StudyPlanProblemSeed } from "./DailyPlanGenerator";
import type { LPProblem, LPState } from "./interface/LPState";
import { getEffectiveConfig, resolveDefaultStudyPlanSlug } from "./LeetPlusConfig";


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
      this.label = `${difficultyEmoji} ${p.id}. ${p.title}`;

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

  constructor(
    private readonly context: vscode.ExtensionContext,
    /**
     * Optional callback to fetch problems from the active study plan.
     * When provided, DailyPlanProvider will auto-seed state.json if the
     * problems list is empty (first-time / clean-state scenario).
     */
    private readonly fetchStudyPlanProblems?: () => Promise<StudyPlanProblemSeed[]>
  ) {}

  refresh(): void {
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
    const workspaceStudySlug = this.context.workspaceState.get<string>("leetplus.selectedStudyPlan")?.trim();
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
        const generated = await generateDailyPlan(workspaceRoot, state);
        planProblems = generated.problems;
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

  private isSolvedToday(problem: LPProblem): boolean {
    if (!problem.completionHistory || problem.completionHistory.length === 0) {
      return false;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    return problem.completionHistory.some(history => history.date.startsWith(todayStr));
  }
}
