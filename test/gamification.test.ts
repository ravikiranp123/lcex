import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  xpForDifficultyLabel,
  xpLevelProgress,
  awardXpForFirstSolve,
  grantDailyLoginXpIfNeeded,
  addBonusXp,
  setDailyGoal,
  dailyGoalProgressPercent,
  TOTAL_XP_KEY,
  XP_GRANTED_SLUGS_KEY,
  LAST_DAILY_LOGIN_XP_DATE_KEY,
} from "../src/modules/Gamification";

function createMemento(store: Record<string, unknown> = {}) {
  return {
    get: <T>(key: string) => store[key] as T | undefined,
    update: async (key: string, value: unknown) => { store[key] = value; },
    keys: async () => Object.keys(store),
  } as any;
}

describe("Gamification", () => {
  let memento: ReturnType<typeof createMemento>;

  beforeEach(() => {
    memento = createMemento();
  });

  describe("xpForDifficultyLabel", () => {
    it("Easy → 10", () => expect(xpForDifficultyLabel("Easy")).toBe(10));
    it("Medium → 20", () => expect(xpForDifficultyLabel("Medium")).toBe(20));
    it("Hard → 40", () => expect(xpForDifficultyLabel("Hard")).toBe(40));
    it("unknown → 15 (default)", () => expect(xpForDifficultyLabel("unknown")).toBe(15));
  });

  describe("xpLevelProgress", () => {
    it("0 XP → level 1, xpInLevel=0", () => {
      const r = xpLevelProgress(0);
      expect(r.level).toBe(1);
      expect(r.xpInLevel).toBe(0);
    });

    it("XP at exact level boundary → correct level and xpInLevel=0", () => {
      const r = xpLevelProgress(100);
      expect(r.level).toBe(2);
      expect(r.xpInLevel).toBe(0);
    });
  });

  describe("awardXpForFirstSolve", () => {
    it("first solve awards XP, returns XP amount > 0", async () => {
      const xp = await awardXpForFirstSolve(memento, "two-sum", "Easy");
      expect(xp).toBe(10);
    });

    it("same slug twice → returns 0 (idempotent)", async () => {
      await awardXpForFirstSolve(memento, "two-sum", "Easy");
      const xp2 = await awardXpForFirstSolve(memento, "two-sum", "Easy");
      expect(xp2).toBe(0);
    });

    it("XP amount matches xpForDifficultyLabel for that difficulty", async () => {
      const xp = await awardXpForFirstSolve(memento, "three-sum", "Hard");
      expect(xp).toBe(40);
    });
  });

  describe("grantDailyLoginXpIfNeeded", () => {
    it("first call today → grants 1 XP, returns 1", async () => {
      const xp = await grantDailyLoginXpIfNeeded(memento);
      expect(xp).toBe(1);
    });

    it("second call same day → returns 0 (already granted)", async () => {
      await grantDailyLoginXpIfNeeded(memento);
      const xp2 = await grantDailyLoginXpIfNeeded(memento);
      expect(xp2).toBe(0);
    });
  });

  describe("addBonusXp", () => {
    it("amount > 0 → total XP increased", async () => {
      await addBonusXp(memento, 50);
      const total = memento.get(TOTAL_XP_KEY);
      expect(total).toBe(50);
    });

    it("amount = 0 or negative → no-op, total XP unchanged", async () => {
      await addBonusXp(memento, 10);
      await addBonusXp(memento, 0);
      await addBonusXp(memento, -5);
      expect(memento.get(TOTAL_XP_KEY)).toBe(10);
    });
  });

  describe("setDailyGoal", () => {
    it("invalid mode → throws", async () => {
      await expect(
        setDailyGoal(memento, { mode: "invalid" as any, target: 5 })
      ).rejects.toThrow();
    });

    it("target > 1000 → throws", async () => {
      await expect(
        setDailyGoal(memento, { mode: "problems", target: 1001 })
      ).rejects.toThrow();
    });
  });

  describe("dailyGoalProgressPercent", () => {
    it("over 100% → clamped to 100", () => {
      expect(dailyGoalProgressPercent(200, 100)).toBe(100);
    });
  });
});
