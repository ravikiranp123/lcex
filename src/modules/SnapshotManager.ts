import * as fs from "fs";
import * as path from "path";
import type { LPSnapshot, LPState } from "./interface/LPState";
import { readState, writeState } from "./StateManager";
import { calculateNextInterval, calculateStreaks, calculatePatternMastery } from "./SRSEngine";
import { detectPatterns } from "./PatternDetector";
import { getHintAccessCount, resetHintAccessCount } from "./HintFile";
import { getProblemTimer } from "./ProblemTimer";
import { languageFromFileExtension } from "./language/LanguageStrategy";

/**
 * Captures a solution file snapshot, registers the completion metadata in state.json,
 * resets session timers and hint counts, runs pattern detection, and recalculates SRS schedules.
 */
export async function captureSnapshot(
  workspaceRoot: string,
  problemId: number,
  slug: string,
  solutionFilePath: string,
  rating: number,
  notes: string,
  aiRating: number = rating,
  aiJustification: string = ""
): Promise<LPSnapshot> {
  const state = await readState(workspaceRoot);
  if (!state) {
    throw new Error("Could not load LeetPlus state file. Make sure the workspace is initialized.");
  }

  // 1. Locate the problem in the state file
  const problem = state.problems.find((p) => p.id === problemId || p.slug === slug);
  if (!problem) {
    throw new Error(`Problem with ID ${problemId} / slug '${slug}' not found in state.`);
  }

  // 2. Read the source code and copy it to snapshots directory
  if (!fs.existsSync(solutionFilePath)) {
    throw new Error(`Solution file not found at: ${solutionFilePath}`);
  }
  const sourceCode = fs.readFileSync(solutionFilePath, "utf-8");
  const ext = path.extname(solutionFilePath);
  
  // Create snapshots target directory: .leetplus/snapshots/<problem_id>/
  const problemSnapshotsDir = path.join(workspaceRoot, ".leetplus", "snapshots", String(problemId));
  if (!fs.existsSync(problemSnapshotsDir)) {
    fs.mkdirSync(problemSnapshotsDir, { recursive: true });
  }

  // Safe timestamp filename (e.g. YYYY-MM-DDTHH-mm-ssZ) to avoid colon characters on Windows/macOS
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const snapshotFileName = `${timestamp}${ext}`;
  const snapshotDestPath = path.join(problemSnapshotsDir, snapshotFileName);
  fs.writeFileSync(snapshotDestPath, sourceCode, "utf-8");

  // 3. Gather session timer metrics
  let timeSpentSeconds = 0;
  const timer = getProblemTimer();
  if (timer) {
    timeSpentSeconds = timer.getElapsedSeconds(slug);
    // Restart/reset timer for this problem slug for the next attempt
    timer.handleRestart(slug);
  }

  // 4. Gather hint access metrics
  const hintsUsed = getHintAccessCount(slug);
  resetHintAccessCount(slug);

  // 5. Run Pattern Detection
  let patternsDetected: string[] = [];
  try {
    const lang = languageFromFileExtension(ext);
    if (lang) {
      const detection = detectPatterns(sourceCode, lang);
      patternsDetected = detection.matched;
    }
  } catch {
    // Fall back to empty if language detection fails
  }

  // 6. Recalculate SRS Schedule & Update Level
  const currentLevel = problem.repetitionLevel;
  const { nextLevel, intervalDays } = calculateNextInterval(rating, currentLevel);
  
  const now = new Date();
  const nextRepTime = now.getTime() + intervalDays * 24 * 60 * 60 * 1000;
  
  problem.status = "completed";
  problem.repetitionLevel = nextLevel;
  problem.nextRepetitionDate = new Date(nextRepTime).toISOString();

  // 7. Update Pattern Mastery scores in the state
  // Map rating to success / struggle / failure outcome
  let outcome: "success" | "struggle" | "failure" = "success";
  if (rating === 3) {
    outcome = "struggle";
  } else if (rating === 4) {
    outcome = "failure";
  }

  // Merge patterns detected with pre-configured patterns for this problem
  const allRelatedPatterns = Array.from(new Set([...(problem.patterns || []), ...patternsDetected]));
  for (const pat of allRelatedPatterns) {
    const currentScore = state.patternMastery[pat] ?? 0.0;
    state.patternMastery[pat] = calculatePatternMastery(currentScore, outcome);
  }

  // 8. Create and append the snapshot record
  const snapshotRecord: LPSnapshot = {
    date: new Date().toISOString(),
    rating,
    notes,
    timeSpentSeconds,
    hintsUsed,
    patternsDetected,
    aiRating,
    aiJustification,
  };

  if (!problem.completionHistory) {
    problem.completionHistory = [];
  }
  problem.completionHistory.push(snapshotRecord);

  // 9. Recalculate active streaks & last activity timestamp
  const { currentStreak, bestStreak } = calculateStreaks(state);
  state.currentStreak = currentStreak;
  state.bestStreak = bestStreak;
  state.lastActivityDate = new Date().toISOString();

  // 10. Persist state.json
  await writeState(workspaceRoot, state);

  // 11. Handle Diff Patch Retention
  let diffRetention = "session";
  const configPath = path.join(workspaceRoot, ".leetplus", "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const parsedConfig = JSON.parse(configContent);
      if (parsedConfig && typeof parsedConfig === "object" && typeof parsedConfig.diffRetention === "string") {
        diffRetention = parsedConfig.diffRetention;
      }
    } catch {
      // Ignore parse errors and use default
    }
  }

  const problemDiffsDir = path.join(workspaceRoot, ".leetplus", "diffs", String(problemId));
  if (fs.existsSync(problemDiffsDir)) {
    if (diffRetention === "session" || diffRetention === "all") {
      // Copy all patches to snapshots directory
      const patchFiles = fs.readdirSync(problemDiffsDir).filter(f => f.endsWith(".patch"));
      for (const patchFile of patchFiles) {
        const srcPath = path.join(problemDiffsDir, patchFile);
        const destPath = path.join(problemSnapshotsDir, patchFile);
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    if (diffRetention === "session" || diffRetention === "none") {
      // Delete the diffs directory for this problem
      const files = fs.readdirSync(problemDiffsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(problemDiffsDir, file));
      }
      fs.rmdirSync(problemDiffsDir);
    }
  }

  return snapshotRecord;
}

/**
 * Returns all snapshots for a given problem ID or slug, sorted chronologically by date.
 */
export async function getSnapshots(
  workspaceRoot: string,
  problemId: number,
  slug?: string
): Promise<LPSnapshot[]> {
  const state = await readState(workspaceRoot);
  if (!state) return [];
  const problem = state.problems.find((p) => p.id === problemId || (slug && p.slug === slug));
  if (!problem || !problem.completionHistory) return [];
  return [...problem.completionHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Returns the most recent snapshot for a given problem ID or slug, or null if none exist.
 */
export async function getLatestSnapshot(
  workspaceRoot: string,
  problemId: number,
  slug?: string
): Promise<LPSnapshot | null> {
  const snaps = await getSnapshots(workspaceRoot, problemId, slug);
  return snaps.length > 0 ? snaps[snaps.length - 1] : null;
}

