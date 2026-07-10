import * as fs from "fs";
import * as path from "path";
import type { LPState, LPProblem, LPSnapshot } from "./interface/LPState";

/**
 * Reads the LeetPlus state file (.leetplus/state.json) from the workspace.
 * Returns null if the file does not exist.
 */
export async function readState(workspaceRoot: string): Promise<LPState | null> {
  const statePath = path.join(workspaceRoot, ".leetplus", "state.json");
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(raw) as LPState;
    
    // Quick validation
    if (parsed && typeof parsed.version === "string" && Array.isArray(parsed.problems)) {
      return parsed;
    }
  } catch (e) {
    // If corrupted or invalid JSON, return null
  }
  return null;
}

/**
 * Writes the LeetPlus state file (.leetplus/state.json) atomically.
 * Prevents corruption by writing to a temporary file first, then renaming.
 */
export async function writeState(workspaceRoot: string, state: LPState): Promise<void> {
  const leetplusDir = path.join(workspaceRoot, ".leetplus");
  if (!fs.existsSync(leetplusDir)) {
    fs.mkdirSync(leetplusDir, { recursive: true });
  }

  const statePath = path.join(leetplusDir, "state.json");
  const tempPath = `${statePath}.tmp`;

  const serialized = JSON.stringify(state, null, 2);
  fs.writeFileSync(tempPath, serialized, "utf-8");
  fs.renameSync(tempPath, statePath);
}

/**
 * Initializes a new LeetPlus state file with a given study plan name and problem list.
 */
export async function initState(
  workspaceRoot: string,
  planName: string,
  problems: LPProblem[],
  planSlug?: string
): Promise<LPState> {
  const newState: LPState = {
    version: "1.0",
    planName,
    planSlug,
    startDate: new Date().toISOString(),
    problems,
    archivedProblems: [],
    currentStreak: 0,
    bestStreak: 0,
    lastActivityDate: null,
    patternMastery: {},
    designProblems: [],
    behavioralStories: [],
  };
  await writeState(workspaceRoot, newState);
  return newState;
}


