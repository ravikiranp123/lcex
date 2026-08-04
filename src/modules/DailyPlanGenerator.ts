import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { LPState, LPProblem } from "./interface/LPState";
import { writeState } from "./StateManager";
import { getEffectiveConfig } from "./LeetPlusConfig";

export interface DailyPlanJson {
  date: string;
  mode: string;
  problems: Array<{ id: number; type: "rep" | "new" }>;
}

export interface StudyPlanProblemSeed {
  id: number | string;
  title: string;
  titleSlug: string;
  difficulty: string;
  topicTags?: string[];
  leetcodeUrl?: string;
  youtubeId?: string | null;
  solutionLink?: { text: string; url: string } | null;
  hints?: string[] | null;
  solution?: { explanation?: string; code?: Record<string, string> } | null;
}

/**
 * Bootstraps `state.json` by seeding it with problems from the active study plan.
 * Only adds problems that don't already exist in state (by slug or id).
 * No-op if `fetchProblems` is not provided.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param state - The current LPState (will be mutated and written to disk).
 * @param fetchProblems - Async function that returns the study plan's problem list.
 * @returns The number of problems added to state.
 */
export async function bootstrapStateFromStudyPlan(
  workspaceRoot: string,
  state: LPState,
  fetchProblems: () => Promise<StudyPlanProblemSeed[]>
): Promise<number> {
  const todayStr = new Date().toISOString().slice(0, 10);

  let problems: StudyPlanProblemSeed[];
  try {
    problems = await fetchProblems();
  } catch {
    return 0;
  }

  const existingSlugs = new Set(state.problems.map((p) => p.slug).filter(Boolean));
  const existingIds = new Set(state.problems.map((p) => String(p.id)));

  const newProblems: LPProblem[] = [];
  let nextId = state.problems.reduce((max, p) => Math.max(max, typeof p.id === "number" ? p.id : 0), 0);

  for (const item of problems) {
    const numId = typeof item.id === "number" ? item.id : parseInt(String(item.id), 10);
    const key = isNaN(numId) ? String(item.id) : String(numId);
    if (existingSlugs.has(item.titleSlug) || existingIds.has(key)) continue;

    nextId++;
    const lp: LPProblem = {
      id: isNaN(numId) ? nextId : numId,
      title: item.title,
      slug: item.titleSlug,
      difficulty: item.difficulty ?? null,
      category: item.topicTags?.[0] ?? "Unknown",
      status: "pending",
      scheduledDate: todayStr,
      nextRepetitionDate: null,
      repetitionLevel: 0,
      completionHistory: [],
      patterns: item.topicTags ?? [],
      leetcodeUrl: item.leetcodeUrl ?? `https://leetcode.com/problems/${item.titleSlug}/`,
      youtubeId: item.youtubeId ?? null,
      solutionLink: item.solutionLink ?? null,
      hints: item.hints ?? null,
      solution: item.solution ?? null,
    };
    newProblems.push(lp);
    existingIds.add(key);
    existingSlugs.add(item.titleSlug);
  }

  if (newProblems.length === 0) return 0;

  state.problems = [...state.problems, ...newProblems];
  await writeState(workspaceRoot, state);
  return newProblems.length;
}

/**
 * Reads a local data file at `.leetplus/data/<planSlug>.json` or `.leetplus/plans/<planSlug>.json`.
 * Expects either `{ "Category": ["slug1", ...] }` or `{ "Category": [{ "id": 1, "slug": "two-sum", ... }] }`.
 *
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function loadSeedsFromLocalDataFile(
  workspaceRoot: string,
  planSlug: string,
  localPath?: string
): StudyPlanProblemSeed[] | null {
  // Determine candidate file path(s) to check, in priority order:
  // 1. Explicit localPath from config (relative or absolute)
  // 2. Default data dir: .leetplus/data/<planSlug>.json
  // 3. Plans dir fallback: .leetplus/plans/<planSlug>.json
  // 4. Extension root data dir fallback: data/<planSlug>.json
  let dataFile: string | null = null;
  if (localPath) {
    const candidate = path.isAbsolute(localPath)
      ? localPath
      : path.join(workspaceRoot, localPath);
    if (fs.existsSync(candidate)) dataFile = candidate;
  }

  if (!dataFile) {
    const candidates = [
      path.join(workspaceRoot, ".leetplus", "data", `${planSlug}.json`),
      path.join(workspaceRoot, ".leetplus", "plans", `${planSlug}.json`),
      path.join(__dirname, "..", "data", `${planSlug}.json`),
      path.join(__dirname, "..", "..", "data", `${planSlug}.json`),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        dataFile = c;
        break;
      }
    }
  }

  if (!dataFile || !fs.existsSync(dataFile)) return null;

  try {
    const raw = fs.readFileSync(dataFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const categoriesMap: Record<string, any[]> =
      parsed.categories && typeof parsed.categories === "object"
        ? parsed.categories
        : parsed;

    const seeds: StudyPlanProblemSeed[] = [];

    for (const [category, items] of Object.entries(categoriesMap)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item) continue;

        if (typeof item === "string") {
          const slug = item.trim();
          if (!slug) continue;
          seeds.push({
            id: slug,
            title: slug
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" "),
            titleSlug: slug,
            difficulty: "Medium",
            topicTags: [category],
          });
        } else if (typeof item === "object") {
          let slug = item.titleSlug || item.slug;
          if (!slug && item.leetcode_url) {
            const match = String(item.leetcode_url).match(/\/problems\/([^/]+)/);
            if (match) slug = match[1];
          }
          if (!slug && item.id !== undefined) {
            slug = String(item.id);
          }
          if (!slug) continue;

          const title = item.title || slug
            .split("-")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

          const id = item.id !== undefined ? item.id : slug;

          seeds.push({
            id,
            title,
            titleSlug: slug,
            difficulty: item.difficulty ?? "Medium",
            topicTags: item.topicTags ?? [category],
            leetcodeUrl: item.leetcode_url ?? item.leetcodeUrl ?? `https://leetcode.com/problems/${slug}/`,
            youtubeId: item.youtube_id ?? item.youtubeId ?? null,
            solutionLink: item.solution_link ?? item.solutionLink ?? null,
            hints: item.hints ?? null,
            solution: item.solution ?? null,
          });
        }
      }
    }

    return seeds.length > 0 ? seeds : null;
  } catch {
    return null;
  }
}

/**
 * Generates and persists the daily spaced repetition (SRS) plan for today.
 */
export async function generateDailyPlan(
  workspaceRoot: string,
  state: LPState,
  focusCategory?: string
): Promise<DailyPlanJson> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const config = getEffectiveConfig(folders);

  const todayStr = new Date().toISOString().slice(0, 10);
  const mode = config.srs?.defaultMode ?? "interleaved";
  const limit = config.srs?.problemsPerDay ?? 5;

  if (!state?.problems) {
    return { date: todayStr, mode, problems: [] };
  }

  let targetProblems = state.problems;
  if (focusCategory) {
    targetProblems = targetProblems.filter((p) => p.category === focusCategory);
  }

  // 1. Gather pending problems
  const pending = targetProblems.filter((p) => p.status === "pending");

  // Implement Weak Pattern Auto-Queue Prioritization
  const patternMastery = state.patternMastery || {};
  pending.sort((a, b) => {
    // Determine minimum pattern mastery score for problem A
    let minScoreA = 1.0;
    if (a.patterns && a.patterns.length > 0) {
      const scores = a.patterns
        .map((p) => patternMastery[p])
        .filter((s) => s !== undefined);
      if (scores.length > 0) {
        minScoreA = Math.min(...scores);
      }
    }

    // Determine minimum pattern mastery score for problem B
    let minScoreB = 1.0;
    if (b.patterns && b.patterns.length > 0) {
      const scores = b.patterns
        .map((p) => patternMastery[p])
        .filter((s) => s !== undefined);
      if (scores.length > 0) {
        minScoreB = Math.min(...scores);
      }
    }

    // Sort by pattern score ascending (weakest first)
    if (minScoreA !== minScoreB) {
      return minScoreA - minScoreB;
    }

    // Fallback to scheduled date
    const dateA = a.scheduledDate || "";
    const dateB = b.scheduledDate || "";
    return dateA.localeCompare(dateB);
  });

  // 2. Gather repetitions due today or earlier
  const repetitionsDue = targetProblems.filter((p) => {
    if (p.status !== "completed" || !p.nextRepetitionDate) return false;
    const repDateStr = p.nextRepetitionDate.slice(0, 10);
    return repDateStr <= todayStr;
  });

  // Split into urgent (rating=4 "Again") and normal reviews
  const urgent: LPProblem[] = [];
  const normal: LPProblem[] = [];

  for (const p of repetitionsDue) {
    const isUrgent =
      p.completionHistory &&
      p.completionHistory.length > 0 &&
      p.completionHistory[p.completionHistory.length - 1].rating === 4;

    if (isUrgent) {
      urgent.push(p);
    } else {
      normal.push(p);
    }
  }

  // 3. Selection selection logic based on mode
  const candidates: Array<{ id: number; type: "rep" | "new" }> = [];

  if (mode === "recap") {
    // Only reviews
    for (const p of urgent) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "rep" });
    }
    for (const p of normal) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "rep" });
    }
    // Fallback if no reviews due: pick random completed problems
    if (candidates.length === 0) {
      const completed = targetProblems.filter((p) => p.status === "completed");
      const shuffled = [...completed].sort(() => 0.5 - Math.random());
      const fallbackCount = Math.min(3, limit, shuffled.length);
      for (let i = 0; i < fallbackCount; i++) {
        candidates.push({ id: shuffled[i].id, type: "rep" });
      }
    }
  } else if (mode === "push") {
    // urgent -> pending -> normal
    for (const p of urgent) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "rep" });
    }
    for (const p of pending) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "new" });
    }
    for (const p of normal) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "rep" });
    }
  } else if (mode === "review-first") {
    // urgent -> normal -> pending
    for (const p of urgent) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "rep" });
    }
    for (const p of normal) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "rep" });
    }
    for (const p of pending) {
      if (candidates.length >= limit) break;
      candidates.push({ id: p.id, type: "new" });
    }
  } else {
    // interleaved (default standard round-robin: 1 urgent -> 1 new -> 1 normal -> 1 new)
    let uIdx = 0, nIdx = 0, pIdx = 0;
    while (candidates.length < limit) {
      let added = false;
      if (uIdx < urgent.length && candidates.length < limit) {
        candidates.push({ id: urgent[uIdx++].id, type: "rep" });
        added = true;
      }
      if (pIdx < pending.length && candidates.length < limit) {
        candidates.push({ id: pending[pIdx++].id, type: "new" });
        added = true;
      }
      if (nIdx < normal.length && candidates.length < limit) {
        candidates.push({ id: normal[nIdx++].id, type: "rep" });
        added = true;
      }
      if (pIdx < pending.length && candidates.length < limit) {
        candidates.push({ id: pending[pIdx++].id, type: "new" });
        added = true;
      }
      if (!added) break;
    }
  }

  // 4. Save plan file: .leetplus/plans/<today>.json
  const plansDir = path.join(workspaceRoot, ".leetplus", "plans");
  if (!fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true });
  }

  const planFile = path.join(plansDir, `${todayStr}.json`);
  const planJson: DailyPlanJson = {
    date: todayStr,
    mode,
    problems: candidates,
  };

  fs.writeFileSync(planFile, JSON.stringify(planJson, null, 2), "utf-8");

  return planJson;
}

/**
 * Appends more problems to today's existing daily plan.
 *
 * Picks `count` additional problems from pending and overdue-repetition pools
 * that are NOT already scheduled in today's plan, using the same SRS priority
 * ordering as `generateDailyPlan`.
 *
 * @param workspaceRoot  Absolute path to the workspace root.
 * @param state          The current LPState.
 * @param count          How many extra problems to add (default 5).
 * @param focusCategory  Optional category filter.
 * @returns The updated DailyPlanJson (with appended problems).
 */
export async function topUpDailyPlan(
  workspaceRoot: string,
  state: LPState,
  count: number = 5,
  focusCategory?: string
): Promise<DailyPlanJson> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const planFile = path.join(workspaceRoot, ".leetplus", "plans", `${todayStr}.json`);

  // Load the existing plan for today, or start with an empty one
  let existing: DailyPlanJson;
  if (fs.existsSync(planFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(planFile, "utf-8")) as DailyPlanJson;
    } catch {
      existing = { date: todayStr, mode: "interleaved", problems: [] };
    }
  } else {
    existing = { date: todayStr, mode: "interleaved", problems: [] };
  }

  // Build a set of problem IDs already in today's plan so we don't duplicate
  const alreadyScheduled = new Set(existing.problems.map((p) => p.id));

  let targetProblems = state.problems ?? [];
  if (focusCategory) {
    targetProblems = targetProblems.filter((p) => p.category === focusCategory);
  }

  // Pending problems — sorted by weak-pattern priority (same ordering as generateDailyPlan)
  const patternMastery = state.patternMastery || {};
  const pending = targetProblems
    .filter((p) => p.status === "pending" && !alreadyScheduled.has(p.id))
    .sort((a, b) => {
      const scoreA =
        a.patterns?.length
          ? Math.min(...a.patterns.map((t) => patternMastery[t] ?? 1.0).filter((s) => s !== undefined))
          : 1.0;
      const scoreB =
        b.patterns?.length
          ? Math.min(...b.patterns.map((t) => patternMastery[t] ?? 1.0).filter((s) => s !== undefined))
          : 1.0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "");
    });

  // Overdue repetitions not yet scheduled
  const overdue = targetProblems.filter((p) => {
    if (p.status !== "completed" || !p.nextRepetitionDate) return false;
    if (alreadyScheduled.has(p.id)) return false;
    return p.nextRepetitionDate.slice(0, 10) <= todayStr;
  });

  // Interleave: overdue rep → new pending (same pattern as interleaved mode)
  const extras: Array<{ id: number; type: "rep" | "new" }> = [];
  let oIdx = 0;
  let pIdx = 0;
  while (extras.length < count) {
    let added = false;
    if (oIdx < overdue.length) {
      extras.push({ id: overdue[oIdx++].id, type: "rep" });
      added = true;
      if (extras.length >= count) break;
    }
    if (pIdx < pending.length) {
      extras.push({ id: pending[pIdx++].id, type: "new" });
      added = true;
    }
    if (!added) break;
  }

  if (extras.length === 0) {
    return existing; // Nothing to add — caller shows a message
  }

  const updated: DailyPlanJson = {
    date: todayStr,
    mode: existing.mode,
    problems: [...existing.problems, ...extras],
  };

  const plansDir = path.join(workspaceRoot, ".leetplus", "plans");
  if (!fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true });
  }
  fs.writeFileSync(planFile, JSON.stringify(updated, null, 2), "utf-8");

  return updated;
}
