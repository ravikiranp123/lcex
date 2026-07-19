import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lcex-report-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

vi.mock("vscode", () => ({ default: {}, workspace: { workspaceFolders: undefined } }), { virtual: true });

const { writeInterviewReportAtPath, readInterviewReportFile, atomicWriteJsonSync } = await import("../src/modules/LeetPlusInterviewReportStore");

function makeReport(overrides?: Partial<Parameters<typeof writeInterviewReportAtPath>[1]>): Parameters<typeof writeInterviewReportAtPath>[1] {
  return {
    version: 1,
    interviewName: "Test Interview",
    sourceLcInterviewPath: "/tmp/test.lcInterview",
    writtenAt: Date.now(),
    entry: {
      startedAt: "2026-01-01T10:00:00.000Z",
      endedAt: "2026-01-01T10:30:00.000Z",
      durationMinutes: 45,
      plannedCount: 3,
      solvedCount: 2,
      bonusXp: 0,
      plannedSlugs: ["two-sum", "three-sum", "four-sum"],
      solvedSlugs: ["two-sum", "three-sum"],
      plannedProblems: [
        { titleSlug: "two-sum", difficulty: "EASY" },
        { titleSlug: "three-sum", difficulty: "MEDIUM" },
        { titleSlug: "four-sum", difficulty: "HARD" },
      ],
      xpBreakdown: { baseXp: 30, bonusXp: 0, totalXp: 30 },
      perProblem: {},
    },
    hubRows: [],
    ...overrides,
  };
}

describe("LeetPlusInterviewReportStore", () => {
  describe("writeInterviewReportAtPath + readInterviewReportFile", () => {
    it("should round-trip data integrity", () => {
      const reportPath = path.join(tmpDir, "report.lcireport");
      const data = makeReport();

      writeInterviewReportAtPath(reportPath, data);
      const readBack = readInterviewReportFile(reportPath);

      expect(readBack).toBeDefined();
      expect(readBack).toEqual(data);
    });
  });

  describe("readInterviewReportFile", () => {
    it("should return undefined for non-existent path", () => {
      const result = readInterviewReportFile(path.join(tmpDir, "nonexistent.lcireport"));
      expect(result).toBeUndefined();
    });

    it("should return undefined for corrupted JSON", () => {
      const corruptPath = path.join(tmpDir, "corrupt.lcireport");
      fs.writeFileSync(corruptPath, "{ not valid json {{{", "utf-8");

      const result = readInterviewReportFile(corruptPath);
      expect(result).toBeUndefined();
    });
  });

  describe("atomicWriteJsonSync", () => {
    it("should not leave .tmp files on disk after successful write", () => {
      const target = path.join(tmpDir, "atomic-test.json");

      atomicWriteJsonSync(target, { hello: "world" });

      const files = fs.readdirSync(tmpDir);
      const tmpFiles = files.filter((f) => f.includes(".tmp"));
      expect(tmpFiles).toEqual([]);

      const content = JSON.parse(fs.readFileSync(target, "utf-8"));
      expect(content).toEqual({ hello: "world" });
    });
  });
});
