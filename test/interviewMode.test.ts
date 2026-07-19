import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startInterviewSession,
  recordInterviewSolve,
  endInterviewSession,
  getInterviewSession,
  remainingMs,
  pickPlannedInterviewProblems,
  INTERVIEW_SESSION_KEY,
  type PlannedInterviewProblem,
} from "../src/modules/InterviewMode";

function createMemento(store: Record<string, unknown> = {}) {
  return {
    get: <T>(key: string) => store[key] as T | undefined,
    update: async (key: string, value: unknown) => { store[key] = value; },
    keys: async () => Object.keys(store),
  } as any;
}

import * as vscode from "vscode";

describe("InterviewMode", () => {
  let memento: ReturnType<typeof createMemento>;

  beforeEach(() => {
    memento = createMemento();
    vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
  });

  describe("startInterviewSession", () => {
    it("writes session to memento with setInterviewContext(true)", async () => {
      const problems: PlannedInterviewProblem[] = [
        { titleSlug: "two-sum", difficulty: "Easy" },
      ];
      await startInterviewSession(memento, 45, problems);
      const session = getInterviewSession(memento);
      expect(session).toBeTruthy();
      expect(session!.active).toBe(true);
      expect(session!.plannedProblems.length).toBe(1);
      expect(session!.durationMinutes).toBe(45);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext", "leetplus.interviewMode", true
      );
    });

    it("deduplicates planned slugs", async () => {
      const problems: PlannedInterviewProblem[] = [
        { titleSlug: "two-sum", difficulty: "Easy" },
        { titleSlug: "two-sum", difficulty: "Easy" },
        { titleSlug: "three-sum", difficulty: "Medium" },
      ];
      await startInterviewSession(memento, 60, problems);
      const session = getInterviewSession(memento);
      expect(session!.plannedProblems.length).toBe(2);
    });
  });

  describe("recordInterviewSolve", () => {
    it("idempotency: same slug solved twice → only recorded once", async () => {
      const problems: PlannedInterviewProblem[] = [
        { titleSlug: "two-sum", difficulty: "Easy" },
      ];
      await startInterviewSession(memento, 45, problems);
      await recordInterviewSolve(memento, "two-sum");
      await recordInterviewSolve(memento, "two-sum");
      const session = getInterviewSession(memento);
      expect(session!.solvedDuringSession).toEqual(["two-sum"]);
    });
  });

  describe("endInterviewSession", () => {
    it("returns null when no active session", async () => {
      const result = await endInterviewSession(memento, "user");
      expect(result).toBeNull();
    });

    it("clears session and calls setInterviewContext(false)", async () => {
      const problems: PlannedInterviewProblem[] = [
        { titleSlug: "two-sum", difficulty: "Easy" },
      ];
      await startInterviewSession(memento, 45, problems);
      const result = await endInterviewSession(memento, "user");
      expect(result).toBeTruthy();
      expect(result!.entry.solvedCount).toBe(0);
      const session = getInterviewSession(memento);
      expect(session).toBeUndefined();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext", "leetplus.interviewMode", false
      );
    });

    it("awards correct XP per difficulty (EASY=10, MEDIUM=20, HARD=40)", async () => {
      const problems: PlannedInterviewProblem[] = [
        { titleSlug: "p1", difficulty: "Easy" },
        { titleSlug: "p2", difficulty: "Medium" },
        { titleSlug: "p3", difficulty: "Hard" },
      ];
      await startInterviewSession(memento, 60, problems);
      await recordInterviewSolve(memento, "p1");
      await recordInterviewSolve(memento, "p2");
      await recordInterviewSolve(memento, "p3");
      const result = await endInterviewSession(memento, "timer");
      expect(result).toBeTruthy();
      expect(result!.entry.xpBreakdown?.easyXp).toBe(10);
      expect(result!.entry.xpBreakdown?.mediumXp).toBe(20);
      expect(result!.entry.xpBreakdown?.hardXp).toBe(40);
    });

    it("perfect-set bonus when all planned slugs solved", async () => {
      const problems: PlannedInterviewProblem[] = [
        { titleSlug: "p1", difficulty: "Easy" },
        { titleSlug: "p2", difficulty: "Medium" },
      ];
      await startInterviewSession(memento, 45, problems);
      await recordInterviewSolve(memento, "p1");
      await recordInterviewSolve(memento, "p2");
      const result = await endInterviewSession(memento, "user");
      expect(result!.entry.xpBreakdown?.perfectBonusXp).toBe(30);
    });
  });

  describe("remainingMs", () => {
    it("expired session → returns 0 (not negative)", () => {
      const session = {
        active: true,
        startedAt: Date.now() - 100000,
        endsAt: Date.now() - 50000,
        plannedProblems: [],
        solvedDuringSession: [],
        durationMinutes: 45,
        interviewTimeBySlug: {},
      };
      expect(remainingMs(session)).toBe(0);
    });
  });

  describe("pickPlannedInterviewProblems", () => {
    it("returns count problems, prefers unsolved over solved", () => {
      const list = [
        { titleSlug: "a", difficulty: "Easy" },
        { titleSlug: "b", difficulty: "Easy" },
        { titleSlug: "c", difficulty: "Medium" },
      ];
      const isSolved = (slug: string) => slug === "a";
      const picked = pickPlannedInterviewProblems(list, 2, isSolved);
      expect(picked.length).toBe(2);
      expect(picked.some(p => p.titleSlug === "b")).toBeTruthy();
    });

    it("count=0 → returns []", () => {
      const list = [{ titleSlug: "a", difficulty: "Easy" }];
      const picked = pickPlannedInterviewProblems(list, 0, () => false);
      expect(picked).toEqual([]);
    });
  });
});
