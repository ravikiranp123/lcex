import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { LPProblem, LPState } from "./interface/LPState";
import { readState, writeState, initState } from "./StateManager";
import { bootstrapStateFromStudyPlan, loadSeedsFromLocalDataFile, type StudyPlanProblemSeed } from "./DailyPlanGenerator";

export type OldProblemDisposition = "keep" | "archive" | "skip" | "remove";

interface SwitchDiff {
  /** Slugs present in both current state and new plan. */
  intersectionSlugs: Set<string>;
  /** State problems NOT in the new plan (may need disposition). */
  oldOnly: LPProblem[];
  /** New plan slugs NOT in the current state (will be added as pending). */
  newOnlySeeds: StudyPlanProblemSeed[];
}

/**
 * Computes the diff between the current state and a new study plan's problem list.
 */
function computeDiff(state: LPState, newPlanSeeds: StudyPlanProblemSeed[]): SwitchDiff {
  const newSlugs = new Set(newPlanSeeds.map((s) => s.titleSlug));
  const stateSlugs = new Set(
    state.problems
      .filter((p) => p.slug)
      .map((p) => p.slug as string)
  );

  const intersectionSlugs = new Set<string>();
  const oldOnly: LPProblem[] = [];

  for (const p of state.problems) {
    if (!p.slug) continue;
    if (newSlugs.has(p.slug)) {
      intersectionSlugs.add(p.slug);
    } else {
      oldOnly.push(p);
    }
  }

  const newOnlySeeds = newPlanSeeds.filter((s) => !stateSlugs.has(s.titleSlug));

  return { intersectionSlugs, oldOnly, newOnlySeeds };
}

/**
 * Applies the user-chosen disposition to the old-only problems.
 * Mutates `state` in-place (does not write to disk).
 */
function applyDisposition(
  state: LPState,
  oldOnly: LPProblem[],
  disposition: OldProblemDisposition
): void {
  const oldSlugs = new Set(oldOnly.map((p) => p.slug).filter(Boolean) as string[]);

  switch (disposition) {
    case "keep":
      // No change — they stay active in state.problems as-is
      break;

    case "archive": {
      // Move them out of state.problems into archivedProblems
      const archived = oldOnly.map((p) => ({ ...p, switchedOut: true }));
      state.archivedProblems = [...(state.archivedProblems ?? []), ...archived];
      state.problems = state.problems.filter((p) => !p.slug || !oldSlugs.has(p.slug));
      break;
    }

    case "skip": {
      // Mark as skipped in-place, set switchedOut flag
      state.problems = state.problems.map((p) => {
        if (p.slug && oldSlugs.has(p.slug)) {
          return { ...p, status: "skipped", switchedOut: true };
        }
        return p;
      });
      break;
    }

    case "remove": {
      // Hard delete — history is lost, switchedOut is NOT set (user explicitly chose this)
      state.problems = state.problems.filter((p) => !p.slug || !oldSlugs.has(p.slug));
      break;
    }
  }
}

/**
 * Auto-restores problems that were previously switched out (archived or skipped via a
 * plan switch) whose slugs appear in the new plan.
 *
 * - Archived (in `archivedProblems`): moved back into `state.problems`
 * - Skipped with `switchedOut` flag: status reset to `"pending"`
 */
function restoreSwitchedOutProblems(
  state: LPState,
  newPlanSlugs: Set<string>
): number {
  let restored = 0;

  // Restore from archivedProblems
  const stillArchived: LPProblem[] = [];
  const toRestore: LPProblem[] = [];

  for (const p of state.archivedProblems ?? []) {
    if (p.switchedOut && p.slug && newPlanSlugs.has(p.slug)) {
      toRestore.push({ ...p, status: "pending", switchedOut: undefined });
      restored++;
    } else {
      stillArchived.push(p);
    }
  }

  if (toRestore.length > 0) {
    state.archivedProblems = stillArchived;
    state.problems = [...state.problems, ...toRestore];
  }

  // Restore skipped-by-switch problems already in state.problems
  state.problems = state.problems.map((p) => {
    if (p.switchedOut && p.slug && newPlanSlugs.has(p.slug) && p.status === "skipped") {
      restored++;
      return { ...p, status: "pending", switchedOut: undefined };
    }
    return p;
  });

  return restored;
}

/**
 * Deletes today's plan file to force regeneration on next DailyPlanProvider load.
 */
function deleteTodayPlanFile(workspaceRoot: string): void {
  const todayStr = new Date().toISOString().slice(0, 10);
  const planFile = path.join(workspaceRoot, ".leetplus", "plans", `${todayStr}.json`);
  if (fs.existsSync(planFile)) {
    try {
      fs.unlinkSync(planFile);
    } catch {
      // Best-effort
    }
  }
}

/**
 * Full study plan switch flow with user confirmation and disposition QuickPick.
 *
 * @param workspaceRoot   Absolute path to the workspace root.
 * @param newPlanSlug     Slug of the new study plan (e.g. "neetcode-150").
 * @param newPlanName     Display name of the new plan (e.g. "NeetCode 150").
 * @param fetchProblems   Async function that returns the new plan's problem list.
 * @returns `"switched"` | `"cancelled"`
 */
export async function switchStudyPlan(
  workspaceRoot: string,
  newPlanSlug: string,
  newPlanName: string,
  fetchProblems: () => Promise<StudyPlanProblemSeed[]>,
  localPath?: string
): Promise<"switched" | "cancelled"> {
  // --- 1. Load new plan seeds (local file first, then API) ---
  let newPlanSeeds: StudyPlanProblemSeed[];
  try {
    const localSeeds = loadSeedsFromLocalDataFile(workspaceRoot, newPlanSlug, localPath);
    if (localSeeds) {
      newPlanSeeds = localSeeds;
    } else {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Loading "${newPlanName}"…` },
        async () => {
          newPlanSeeds = await fetchProblems();
        }
      );
    }
  } catch (e) {
    vscode.window.showErrorMessage(
      `Failed to load "${newPlanName}". Check your connection and try again.`
    );
    return "cancelled";
  }

  const newSlugs = new Set(newPlanSeeds!.map((s) => s.titleSlug));

  // --- 2. Load current state ---
  let state = await readState(workspaceRoot);

  // No state yet — just bootstrap directly
  if (!state || state.problems.length === 0) {
    if (!state) {
      state = await initState(workspaceRoot, newPlanName, [], newPlanSlug);
    } else {
      state.planName = newPlanName;
      state.planSlug = newPlanSlug;
    }
    const added = await bootstrapStateFromStudyPlan(workspaceRoot, state, async () => newPlanSeeds!);
    deleteTodayPlanFile(workspaceRoot);
    vscode.window.showInformationMessage(
      `Switched to "${newPlanName}" — ${added} problems added.`
    );
    return "switched";
  }

  // --- 3. Already on the same plan? ---
  if (state.planSlug === newPlanSlug) {
    vscode.window.showInformationMessage(`"${newPlanName}" is already your active plan.`);
    return "cancelled";
  }

  // --- 4. Compute diff ---
  const diff = computeDiff(state, newPlanSeeds!);

  // Check for problems to auto-restore from previous switch-outs
  const restorable = [
    ...(state.archivedProblems ?? []).filter((p) => p.switchedOut && p.slug && newSlugs.has(p.slug)),
    ...state.problems.filter((p) => p.switchedOut && p.slug && newSlugs.has(p.slug) && p.status === "skipped"),
  ];

  const completedCount = state.problems.filter((p) => p.status === "completed").length;
  const hasOldOnly = diff.oldOnly.length > 0;

  // --- 5. Confirm switch ---
  const summaryLines: string[] = [];
  summaryLines.push(`Current plan: ${state.planName}`);
  if (diff.intersectionSlugs.size > 0) {
    summaryLines.push(`✅  ${diff.intersectionSlugs.size} problems kept (in both plans)`);
  }
  if (hasOldOnly) {
    summaryLines.push(`📦  ${diff.oldOnly.length} problems only in your current plan`);
  }
  if (diff.newOnlySeeds.length > 0) {
    summaryLines.push(`🆕  ${diff.newOnlySeeds.length} new problems to add`);
  }
  if (restorable.length > 0) {
    summaryLines.push(`♻️  ${restorable.length} previously switched-out problems will be restored`);
  }

  const confirmLabel = hasOldOnly ? "Switch (choose what to do with old problems)" : "Switch";
  const proceed = await vscode.window.showInformationMessage(
    `Switch to "${newPlanName}"?\n\n${summaryLines.join("\n")}`,
    { modal: true },
    confirmLabel,
    "Cancel"
  );

  if (!proceed || proceed === "Cancel") return "cancelled";

  // --- 6. If there are old-only problems, ask what to do with them ---
  let disposition: OldProblemDisposition = "keep";

  if (hasOldOnly) {
    type DispositionItem = vscode.QuickPickItem & { value: OldProblemDisposition };
    const items: DispositionItem[] = [
      {
        label: "$(play) Keep them active",
        description: `Stay in your rotation alongside "${newPlanName}"`,
        value: "keep",
      },
      {
        label: "$(archive) Archive them",
        description: "Hide from daily plan — history preserved, auto-restored if you switch back",
        value: "archive",
      },
      {
        label: "$(debug-step-over) Skip them",
        description: "Mark as skipped — visible in state, auto-restored if you switch back",
        value: "skip",
      },
      {
        label: "$(trash) Remove them",
        description: `Delete from state — ⚠️ history lost, cannot be undone (${completedCount > 0 ? `${diff.oldOnly.filter((p) => p.status === "completed").length} completed` : "all pending"})`,
        value: "remove",
      },
    ];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: `What should happen to the ${diff.oldOnly.length} problems only in "${state.planName}"?`,
      title: "Plan Switch — Old Problems",
      ignoreFocusOut: true,
    });

    if (!picked) return "cancelled";
    disposition = picked.value;
  }

  // --- 7. Apply changes ---

  // Auto-restore switched-out problems belonging to the new plan
  const restoredCount = restoreSwitchedOutProblems(state, newSlugs);

  // Apply chosen disposition to old-only problems
  if (hasOldOnly) {
    applyDisposition(state, diff.oldOnly, disposition);
  }

  // Add new-only problems as pending (skip any already restored above)
  const existingSlugsAfter = new Set(state.problems.map((p) => p.slug).filter(Boolean) as string[]);
  const todayStr = new Date().toISOString().slice(0, 10);
  let nextId = state.problems.reduce((max, p) => Math.max(max, p.id), 0);

  for (const seed of diff.newOnlySeeds) {
    if (existingSlugsAfter.has(seed.titleSlug)) continue;
    nextId++;
    const numId = parseInt(seed.id, 10);
    const newProblem: LPProblem = {
      id: isNaN(numId) ? nextId : numId,
      title: seed.title,
      slug: seed.titleSlug,
      difficulty: seed.difficulty ?? null,
      category: seed.topicTags?.[0] ?? "Unknown",
      status: "pending",
      scheduledDate: todayStr,
      nextRepetitionDate: null,
      repetitionLevel: 0,
      completionHistory: [],
      patterns: seed.topicTags ?? [],
      leetcodeUrl: `https://leetcode.com/problems/${seed.titleSlug}/`,
      youtubeId: null,
      solutionLink: null,
      hints: null,
      solution: null,
    };
    state.problems.push(newProblem);
    existingSlugsAfter.add(seed.titleSlug);
  }

  // Update plan identity
  state.planName = newPlanName;
  state.planSlug = newPlanSlug;

  // --- 8. Persist ---
  await writeState(workspaceRoot, state);
  deleteTodayPlanFile(workspaceRoot);

  // --- 9. Summary toast ---
  const parts: string[] = [`Switched to "${newPlanName}".`];
  if (diff.newOnlySeeds.length > 0) parts.push(`${diff.newOnlySeeds.length} new problems added.`);
  if (restoredCount > 0) parts.push(`${restoredCount} problems restored.`);
  if (hasOldOnly) {
    const dispositionText: Record<OldProblemDisposition, string> = {
      keep: `${diff.oldOnly.length} old problems kept active.`,
      archive: `${diff.oldOnly.length} old problems archived.`,
      skip: `${diff.oldOnly.length} old problems skipped.`,
      remove: `${diff.oldOnly.length} old problems removed.`,
    };
    parts.push(dispositionText[disposition]);
  }

  vscode.window.showInformationMessage(parts.join(" "));
  return "switched";
}
