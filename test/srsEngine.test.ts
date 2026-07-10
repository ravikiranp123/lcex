import { describe, it } from "node:test";
import assert from "node:assert";
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
      assert.strictEqual(r.nextLevel, 99);
      assert.strictEqual(r.intervalDays, 365);
    });

    it("should handle Easy rating (rating=1)", () => {
      const r = calculateNextInterval(1, 5);
      assert.strictEqual(r.nextLevel, 6);
      assert.strictEqual(r.intervalDays, 20);
    });

    it("should handle Good rating (rating=2) with level index lookup", () => {
      // REPETITION_INTERVALS = [1, 7, 16, 35, 90]
      const r0 = calculateNextInterval(2, 0);
      assert.strictEqual(r0.nextLevel, 1);
      assert.strictEqual(r0.intervalDays, 1);

      const r3 = calculateNextInterval(2, 3);
      assert.strictEqual(r3.nextLevel, 4);
      assert.strictEqual(r3.intervalDays, 35);

      const rOver = calculateNextInterval(2, 10);
      assert.strictEqual(rOver.nextLevel, 11);
      assert.strictEqual(rOver.intervalDays, 90); // max index 4 (value 90)
    });

    it("should handle Hard rating (rating=3)", () => {
      const r = calculateNextInterval(3, 5);
      assert.strictEqual(r.nextLevel, 4);
      assert.strictEqual(r.intervalDays, 2);

      const rClamp = calculateNextInterval(3, 0);
      assert.strictEqual(rClamp.nextLevel, 0);
      assert.strictEqual(rClamp.intervalDays, 2);
    });

    it("should handle Again rating (rating=4)", () => {
      const r = calculateNextInterval(4, 10);
      assert.strictEqual(r.nextLevel, 0);
      assert.strictEqual(r.intervalDays, 1);
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
      assert.strictEqual(res.currentStreak, 0);
      assert.strictEqual(res.bestStreak, 0);
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
      assert.strictEqual(res.currentStreak, 3, "should be 3 days: 8th, 9th, 10th");
      assert.strictEqual(res.bestStreak, 3);
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
      assert.strictEqual(res.currentStreak, 0, "Last activity was 8th (today is 10th), so streak is broken");
      assert.strictEqual(res.bestStreak, 3, "Best streak was 1st-3rd (3 days)");
    });
  });

  describe("calculatePatternMastery", () => {
    it("should compute success scores", () => {
      const r = calculatePatternMastery(0.5, "success");
      assert.strictEqual(r, 0.5 + 0.1 * 0.5); // 0.55
    });

    it("should compute struggle scores", () => {
      const r = calculatePatternMastery(0.5, "struggle");
      assert.strictEqual(r, 0.5 + 0.05 * 0.5); // 0.525
    });

    it("should compute failure scores", () => {
      const r = calculatePatternMastery(0.5, "failure");
      assert.strictEqual(r, 0.4);
    });

    it("should clamp values between 0.0 and 1.0", () => {
      assert.strictEqual(calculatePatternMastery(0.95, "success"), 0.955);
      assert.strictEqual(calculatePatternMastery(0.05, "failure"), 0);
      assert.strictEqual(calculatePatternMastery(1.0, "success"), 1.0);
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
      assert.strictEqual(due.length, 2);
      assert.strictEqual(due[0].id, 1);
      assert.strictEqual(due[1].id, 3);
    });
  });
});
