import { describe, it, expect } from "vitest";
import {
  calculateNextInterval,
  calculateStreaks,
  calculatePatternMastery,
  getDueProblems,
  REPETITION_INTERVALS,
} from "../src/modules/SRSEngine";
import type { LPState } from "../src/modules/interface/LPState";

describe("SRSEngine", () => {
  describe("calculateNextInterval", () => {
    it("should handle Mastered rating (rating=0)", () => {
      const r = calculateNextInterval(0, 5);
      expect(r.nextLevel).toBe(99);
      expect(r.intervalDays).toBe(365);
    });

    it("should handle Easy rating (rating=1)", () => {
      const r = calculateNextInterval(1, 5);
      expect(r.nextLevel).toBe(6);
      expect(r.intervalDays).toBe(20);
    });

    it("should handle Good rating (rating=2) with level index lookup", () => {
      // REPETITION_INTERVALS = [1, 7, 16, 35, 90]
      const r0 = calculateNextInterval(2, 0);
      expect(r0.nextLevel).toBe(1);
      expect(r0.intervalDays).toBe(1);

      const r3 = calculateNextInterval(2, 3);
      expect(r3.nextLevel).toBe(4);
      expect(r3.intervalDays).toBe(35);

      const rOver = calculateNextInterval(2, 10);
      expect(rOver.nextLevel).toBe(11);
      expect(rOver.intervalDays).toBe(90); // max index 4 (value 90)
    });

    it("should handle Hard rating (rating=3)", () => {
      const r = calculateNextInterval(3, 5);
      expect(r.nextLevel).toBe(4);
      expect(r.intervalDays).toBe(2);

      const rClamp = calculateNextInterval(3, 0);
      expect(rClamp.nextLevel).toBe(0);
      expect(rClamp.intervalDays).toBe(2);
    });

    it("should handle Again rating (rating=4)", () => {
      const r = calculateNextInterval(4, 10);
      expect(r.nextLevel).toBe(0);
      expect(r.intervalDays).toBe(1);
    });

    it("rating 1 at level 99 → level stays at 99 (cap enforced)", () => {
      const r = calculateNextInterval(1, 99);
      expect(r.nextLevel).toBe(99);
      expect(r.intervalDays).toBe(20);
    });

    it("negative currentLevel (e.g. -5) → clamped to 0", () => {
      const rHard = calculateNextInterval(3, -5);
      expect(rHard.nextLevel).toBe(0);
      expect(rHard.intervalDays).toBe(2);

      const rEasy = calculateNextInterval(1, -5);
      expect(rEasy.nextLevel).toBe(1);
      expect(rEasy.intervalDays).toBe(20);
    });

    it("out-of-range rating (e.g. 99) → default case: interval=1, level=0", () => {
      const r = calculateNextInterval(99, 10);
      expect(r.nextLevel).toBe(0);
      expect(r.intervalDays).toBe(1);
    });
  });

  describe("calculateStreaks", () => {
    const today = new Date("2026-07-10T12:00:00.000Z");

    it("should return 0 when completion history is empty", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };
      const res = calculateStreaks(state, today);
      expect(res.currentStreak).toBe(0);
      expect(res.bestStreak).toBe(0);
    });

    it("should calculate active streaks", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [
          {
            id: 1,
            title: "P1",
            slug: "p1",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [
              { date: "2026-07-08T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
              { date: "2026-07-09T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
            ],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
          {
            id: 2,
            title: "P2",
            slug: "p2",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [
              { date: "2026-07-10T08:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
            ],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          }
        ],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };

      const res = calculateStreaks(state, today);
      expect(res.currentStreak).toBe(3);
      expect(res.bestStreak).toBe(3);
    });

    it("should handle broken and expired streaks", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [
          {
            id: 1,
            title: "P1",
            slug: "p1",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [
              { date: "2026-07-01T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
              { date: "2026-07-02T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
              { date: "2026-07-03T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
              // Gap here: 4th, 5th, 6th missing
              { date: "2026-07-07T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
              { date: "2026-07-08T10:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
            ],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          }
        ],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };

      const res = calculateStreaks(state, today);
      expect(res.currentStreak).toBe(0);
      expect(res.bestStreak).toBe(3);
    });

    it("single date in history → currentStreak=1, bestStreak=1", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [
          {
            id: 1,
            title: "P1",
            slug: "p1",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [
              { date: "2026-07-10T08:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
            ],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
        ],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };
      const res = calculateStreaks(state, today);
      expect(res.currentStreak).toBe(1);
      expect(res.bestStreak).toBe(1);
    });

    it("two problems solved on same day → date deduplicated, still streak=1", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [
          {
            id: 1,
            title: "P1",
            slug: "p1",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [
              { date: "2026-07-10T08:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
            ],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
          {
            id: 2,
            title: "P2",
            slug: "p2",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [
              { date: "2026-07-10T14:00:00.000Z", rating: 2, notes: "", timeSpentSeconds: 0, hintsUsed: 0, patternsDetected: [], aiRating: 0, aiJustification: "" },
            ],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
        ],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };
      const res = calculateStreaks(state, today);
      expect(res.currentStreak).toBe(1);
      expect(res.bestStreak).toBe(1);
    });
  });

  describe("calculatePatternMastery", () => {
    it("should compute success scores", () => {
      const r = calculatePatternMastery(0.5, "success");
      expect(r).toBe(0.5 + 0.1 * 0.5); // 0.55
    });

    it("should compute struggle scores", () => {
      const r = calculatePatternMastery(0.5, "struggle");
      expect(r).toBe(0.5 + 0.05 * 0.5); // 0.525
    });

    it("should compute failure scores", () => {
      const r = calculatePatternMastery(0.5, "failure");
      expect(r).toBe(0.4);
    });

    it("should clamp values between 0.0 and 1.0", () => {
      expect(calculatePatternMastery(0.95, "success")).toBe(0.955);
      expect(calculatePatternMastery(0.05, "failure")).toBe(0);
      expect(calculatePatternMastery(1.0, "success")).toBe(1.0);
    });

    it("currentScore=1.0 + success → still clamped to 1.0", () => {
      expect(calculatePatternMastery(1.0, "success")).toBe(1.0);
    });

    it("currentScore=0.0 + failure → still clamped to 0.0", () => {
      expect(calculatePatternMastery(0.0, "failure")).toBe(0);
    });
  });

  describe("getDueProblems", () => {
    const checkDate = new Date("2026-07-10T12:00:00.000Z");

    it("should return due pending and scheduled problems", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [
          {
            id: 1,
            title: "P1 (Completed, Due)",
            slug: "p1",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "2026-07-01T00:00:00.000Z",
            nextRepetitionDate: "2026-07-09T00:00:00.000Z",
            repetitionLevel: 1,
            completionHistory: [],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
          {
            id: 2,
            title: "P2 (Completed, Not Due)",
            slug: "p2",
            difficulty: "Easy",
            category: "Arrays",
            status: "completed",
            scheduledDate: "2026-07-01T00:00:00.000Z",
            nextRepetitionDate: "2026-07-11T00:00:00.000Z",
            repetitionLevel: 1,
            completionHistory: [],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
          {
            id: 3,
            title: "P3 (Pending, Due)",
            slug: "p3",
            difficulty: "Easy",
            category: "Arrays",
            status: "pending",
            scheduledDate: "2026-07-09T00:00:00.000Z",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
          {
            id: 4,
            title: "P4 (Pending, Not Due)",
            slug: "p4",
            difficulty: "Easy",
            category: "Arrays",
            status: "pending",
            scheduledDate: "2026-07-11T00:00:00.000Z",
            nextRepetitionDate: null,
            repetitionLevel: 0,
            completionHistory: [],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          }
        ],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };

      const due = getDueProblems(state, checkDate);
      expect(due.length).toBe(2);
      expect(due[0].id).toBe(1);
      expect(due[1].id).toBe(3);
    });

    it("skipped status + nextRepetitionDate in past → included as due", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [
          {
            id: 1,
            title: "P1",
            slug: "p1",
            difficulty: "Easy",
            category: "Arrays",
            status: "skipped",
            scheduledDate: "",
            nextRepetitionDate: "2026-07-05T00:00:00.000Z",
            repetitionLevel: 0,
            completionHistory: [],
            patterns: [],
            leetcodeUrl: null,
            youtubeId: null,
            solutionLink: null,
            hints: null,
            solution: null,
          },
        ],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };
      const due = getDueProblems(state, checkDate);
      expect(due.length).toBe(1);
      expect(due[0].id).toBe(1);
    });

    it("empty problems array → returns []", () => {
      const state: LPState = {
        version: "1.0",
        planName: "Test",
        startDate: "",
        problems: [],
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
        patternMastery: {},
        designProblems: [],
        behavioralStories: [],
      };
      const due = getDueProblems(state, checkDate);
      expect(due).toEqual([]);
    });
  });
});
