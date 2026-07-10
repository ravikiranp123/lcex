import type { LPState } from "./interface/LPState";

export const REPETITION_INTERVALS = [1, 7, 16, 35, 90];

export interface SRSResult {
  nextLevel: number;
  intervalDays: number;
}

/**
 * Calculates the next repetition interval and level based on rating and current level.
 * Level is clamped to [0, 99].
 * Ratings:
 * - 0 (Mastered): interval = 365 days, level = 99
 * - 1 (Easy): interval = 20 days, level = current + 1
 * - 2 (Good): interval = REPETITION_INTERVALS[min(current, 4)], level = current + 1
 * - 3 (Hard): interval = 2 days, level = max(0, current - 1)
 * - 4 (Again): interval = 1 day, level = 0
 */
export function calculateNextInterval(rating: number, currentLevel: number): SRSResult {
  // Clamp currentLevel to [0, 99]
  const level = Math.max(0, Math.min(99, currentLevel));

  switch (rating) {
    case 0: // Mastered
      return { nextLevel: 99, intervalDays: 365 };
    case 1: // Easy
      return { nextLevel: Math.min(99, level + 1), intervalDays: 20 };
    case 2: // Good
      const index = Math.min(level, 4);
      return { nextLevel: Math.min(99, level + 1), intervalDays: REPETITION_INTERVALS[index] };
    case 3: // Hard
      return { nextLevel: Math.max(0, level - 1), intervalDays: 2 };
    case 4: // Again
    default:
      return { nextLevel: 0, intervalDays: 1 };
  }
}

/**
 * Calculates the current and best streaks based on completion history.
 * A streak is consecutive unique calendar days of solves (in UTC).
 * The current streak remains active if the last solve was today or yesterday (in UTC).
 */
export function calculateStreaks(state: LPState, todayDateUtc: Date = new Date()): { currentStreak: number; bestStreak: number } {
  const datesSet = new Set<string>();

  // Extract all unique completion dates in YYYY-MM-DD format (UTC)
  for (const p of state.problems) {
    for (const snap of p.completionHistory) {
      if (snap.date) {
        try {
          const dateStr = snap.date.split("T")[0]; // "YYYY-MM-DD"
          if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            datesSet.add(dateStr);
          }
        } catch {
          // ignore malformed dates
        }
      }
    }
  }

  if (datesSet.size === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  // Sort dates chronologically
  const sortedDates = Array.from(datesSet).sort();

  let bestStreak = 1;
  let currentStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevStr = sortedDates[i - 1];
    const currStr = sortedDates[i];
    if (!prevStr || !currStr) continue;

    const prevTime = Date.parse(prevStr);
    const currTime = Date.parse(currStr);

    const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
    } else if (diffDays > 1) {
      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
      }
      tempStreak = 1;
    }
  }

  if (tempStreak > bestStreak) {
    bestStreak = tempStreak;
  }

  // Check if current streak is still active (last solve is today or yesterday in UTC)
  const lastSolveStr = sortedDates[sortedDates.length - 1];
  if (lastSolveStr) {
    const lastSolveTime = Date.parse(lastSolveStr);
    
    // Normalize today to YYYY-MM-DD
    const todayStr = todayDateUtc.toISOString().split("T")[0];
    const todayTime = Date.parse(todayStr || "");

    const diffDaysFromToday = Math.round((todayTime - lastSolveTime) / (1000 * 60 * 60 * 24));

    if (diffDaysFromToday <= 1) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }
  } else {
    currentStreak = 0;
  }

  return { currentStreak, bestStreak };
}

/**
 * Updates a pattern score based on outcome.
 * clamped to [0.0, 1.0]
 */
export function calculatePatternMastery(
  currentScore: number,
  outcome: "success" | "struggle" | "failure"
): number {
  const current = Math.max(0, Math.min(1, currentScore));
  let next = current;

  switch (outcome) {
    case "success":
      next = current + 0.1 * (1.0 - current);
      break;
    case "struggle":
      next = current + 0.05 * (1.0 - current);
      break;
    case "failure":
      next = current - 0.1;
      break;
  }

  return Math.max(0, Math.min(1, next));
}

/**
 * Filters the problems list in state to return all that are due for review.
 * A problem is due if nextRepetitionDate <= dateToCheck (defaulting to current date).
 * Pending problems (status === "pending" or not yet completed) are not counted as due in SRS
 * unless they were scheduled in the past. If status is pending but scheduledDate <= dateToCheck,
 * it is considered due.
 */
export function getDueProblems(state: LPState, dateToCheck: Date = new Date()): typeof state.problems {
  const checkTime = dateToCheck.getTime();
  
  return state.problems.filter((p) => {
    // If completed or skipped, check nextRepetitionDate
    if (p.status === "completed" || p.status === "skipped") {
      if (!p.nextRepetitionDate) return false;
      const repTime = Date.parse(p.nextRepetitionDate);
      return repTime <= checkTime;
    }
    
    // If pending, check scheduledDate
    const schedTime = Date.parse(p.scheduledDate);
    return schedTime <= checkTime;
  });
}
