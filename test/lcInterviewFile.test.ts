import { describe, it, expect } from "vitest";
import {
  parseLcInterviewFile,
  serializeLcInterviewFile,
  defaultInterviewNameFromDate,
  LC_INTERVIEW_VERSION,
  ATTEMPT_ID_RE,
} from "../src/modules/LcInterviewFile";

describe("LcInterviewFile", () => {
  describe("parseLcInterviewFile", () => {
    it("should parse valid v1 JSON and return all fields", () => {
      const input = JSON.stringify({
        version: 1,
        name: "Meta SDE 3",
        durationMinutes: 60,
        problems: [{ titleSlug: "two-sum", difficulty: "Easy" }],
        tags: ["arrays", "hashmap"],
        attempts: [{ id: "a1b", time: "2026-03-23T12:00:00.000Z" }],
      });

      const result = parseLcInterviewFile(input);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.version).toBe(LC_INTERVIEW_VERSION);
      expect(result.data.name).toBe("Meta SDE 3");
      expect(result.data.durationMinutes).toBe(60);
      expect(result.data.problems).toEqual([{ titleSlug: "two-sum", difficulty: "EASY" }]);
      expect(result.data.tags).toEqual(["arrays", "hashmap"]);
      expect(result.data.attempts).toEqual([{ id: "a1b", time: "2026-03-23T12:00:00.000Z" }]);
    });

    it("should reject unknown version", () => {
      const input = JSON.stringify({ version: 99, name: "Test", durationMinutes: 45, problems: [] });

      const result = parseLcInterviewFile(input);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain("version");
    });

    it("should reject durationMinutes not in allowlist", () => {
      const input = JSON.stringify({ version: 1, name: "Test", durationMinutes: 30, problems: [] });

      const result = parseLcInterviewFile(input);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain("durationMinutes");
    });

    it("should normalize string problems to PlannedInterviewProblem objects", () => {
      const input = JSON.stringify({
        version: 1,
        name: "Test",
        durationMinutes: 45,
        problems: ["two-sum", "three-sum"],
      });

      const result = parseLcInterviewFile(input);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.problems).toEqual([
        { titleSlug: "two-sum", difficulty: "MEDIUM" },
        { titleSlug: "three-sum", difficulty: "MEDIUM" },
      ]);
    });

    it("should pass through problem objects preserving difficulty", () => {
      const input = JSON.stringify({
        version: 1,
        name: "Test",
        durationMinutes: 45,
        problems: [{ titleSlug: "two-sum", difficulty: "Medium" }],
      });

      const result = parseLcInterviewFile(input);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.problems).toEqual([{ titleSlug: "two-sum", difficulty: "MEDIUM" }]);
    });

    it("should filter tags > 64 chars and cap at 16", () => {
      const longTag = "a".repeat(65);
      const validTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
      const input = JSON.stringify({
        version: 1,
        name: "Test",
        durationMinutes: 45,
        problems: [],
        tags: [...validTags, longTag],
      });

      const result = parseLcInterviewFile(input);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.tags!.length).toBeLessThanOrEqual(16);
      expect(result.data.tags!.some((t) => t.length > 64)).toBe(false);
    });

    it("should strip attempts with invalid id format", () => {
      const input = JSON.stringify({
        version: 1,
        name: "Test",
        durationMinutes: 45,
        problems: [],
        attempts: [
          { id: "ab1", time: "2026-01-01T00:00:00.000Z" },
          { id: "zzzz", time: "2026-01-01T00:00:00.000Z" },
        ],
      });

      const result = parseLcInterviewFile(input);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.attempts).toEqual([{ id: "ab1", time: "2026-01-01T00:00:00.000Z" }]);
    });
  });

  describe("defaultInterviewNameFromDate", () => {
    it("should return YYYY-MM-DD format", () => {
      const name = defaultInterviewNameFromDate();
      expect(name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
