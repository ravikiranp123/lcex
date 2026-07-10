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
  id: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  topicTags?: string[];
}

/**
 * Bootstraps `state.json` by seeding it with problems from the active study plan.
 * Only adds problems that don't already exist in state (by id).
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
  const existingIds = new Set(state.problems.map((p) => String(p.id)));

  let problems: StudyPlanProblemSeed[];
  try {
    problems = await fetchProblems();
  } catch {
    return 0;
  }

  const newProblems: LPProblem[] = [];
  let nextId = state.problems.reduce((max, p) => Math.max(max, p.id), 0);

  for (const item of problems) {
    const numId = parseInt(item.id, 10);
    const key = isNaN(numId) ? item.id : String(numId);
    if (existingIds.has(key)) continue;

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
      leetcodeUrl: `https://leetcode.com/problems/${item.titleSlug}/`,
      youtubeId: null,
      solutionLink: null,
      hints: null,
      solution: null,
    };
    newProblems.push(lp);
    existingIds.add(key);
  }

  if (newProblems.length === 0) return 0;

  state.problems = [...state.problems, ...newProblems];
  await writeState(workspaceRoot, state);
  return newProblems.length;
}

/**
 * Reads a local data file at `.leetplus/data/<planSlug>.json`.
 * Expects the schema: `{ "Category Name": ["slug1", "slug2", ...], ... }`
 * Returns an array of `StudyPlanProblemSeed` with stub title/difficulty fields
 * (the category name is used as the first topicTag).
 *
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function loadSeedsFromLocalDataFile(
  workspaceRoot: string,
  planSlug: string,
  localPath?: string
): StudyPlanProblemSeed[] | null {
  const dataFile = localPath
    ? (path.isAbsolute(localPath) ? localPath : path.join(workspaceRoot, localPath))
    : path.join(workspaceRoot, ".leetplus", "data", `${planSlug}.json`);
  if (!fs.existsSync(dataFile)) return null;

  try {
    const raw = fs.readFileSync(dataFile, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const seeds: StudyPlanProblemSeed[] = [];

    for (const [category, slugs] of Object.entries(parsed)) {
      if (!Array.isArray(slugs)) continue;
      for (const slug of slugs) {
        if (typeof slug !== "string") continue;
        seeds.push({
          // Use slug as id — numeric id will be assigned during bootstrap
          id: slug,
          // Stub title: convert "two-sum" → "Two Sum"; will display until API enriches it
          title: slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          titleSlug: slug,
          difficulty: "Medium", // Conservative default; enriched by API later
          topicTags: [category],
        });
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
