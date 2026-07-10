export interface LPState {
  version: string;               // "1.0"
  planName: string;               // e.g. "NeetCode 150"
  /** Machine-readable slug of the active study plan (e.g. "neetcode-150"). Used to diff on plan switch. */
  planSlug?: string;
  startDate: string;              // ISO date UTC
  problems: LPProblem[];          // Full problem list with SRS data
  /** Problems hidden by a study plan switch. Restored when the user switches back to their original plan. */
  archivedProblems?: LPProblem[];
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string | null;
  patternMastery: Record<string, number>; // Pattern name -> 0.0-1.0
  designProblems: LPDesignProblem[];
  behavioralStories: LPBehavioralStory[];
}

export interface LPProblem {
  id: number;
  title: string;
  slug: string | null;
  difficulty: string | null;
  category: string;
  status: "pending" | "completed" | "skipped";
  scheduledDate: string;          // ISO date UTC
  nextRepetitionDate: string | null; // ISO date UTC
  repetitionLevel: number;        // 0-99
  completionHistory: LPSnapshot[];
  patterns: string[];
  leetcodeUrl: string | null;
  youtubeId: string | null;
  solutionLink: { text: string; url: string } | null;
  hints: string[] | null;
  solution: { explanation: string; code: Record<string, string> } | null;
  /**
   * Set to true when this problem was skipped/archived automatically by a
   * study plan switch (not by the user manually). Enables auto-restore when
   * the user switches back to the plan that originally contained this problem.
   */
  switchedOut?: boolean;
}

export interface LPSnapshot {
  date: string;                   // ISO date UTC
  rating: number;                 // 0-4
  notes: string;
  timeSpentSeconds: number;       // From ProblemTimer
  hintsUsed: number;              // Count of hint accesses
  patternsDetected: string[];     // From PatternDetector
  aiRating: number;               // AI's suggested rating
  aiJustification: string;        // AI's reasoning
  diffPatchPaths?: string[];      // Paths to session diff patches
}

export interface LPDesignProblem {
  id: string;
  title: string;
  type: "HLD" | "LLD";
  status: "pending" | "completed" | "skipped";
  scheduledDate: string;
  nextRepetitionDate: string | null;
  repetitionLevel: number;
  completionHistory: LPSnapshot[];
  category: string;
  tags: string[];
}

export interface LPBehavioralStory {
  id: string;
  topic: string;                  // "Leadership", "Conflict", "Failure", "Initiative"
  company?: string;               // Optional target company
  situation: string;              // STAR situation (10%)
  task: string;                   // STAR task (10%)
  action: string;                 // STAR action (60%)
  result: string;                 // STAR result (20%, quantified)
  tags: string[];
  createdAt: string;              // ISO date UTC
  lastPracticedAt?: string;       // ISO date UTC
  practiceCount: number;
}
