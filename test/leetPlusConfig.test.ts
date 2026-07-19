import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  inferListSourceForSlug,
  reconcileListSource,
  resolveDefaultStudyPlanSlug,
  resolveDefaultProblemListSlug,
  parseLeetPlusConfig,
} from "../src/modules/LeetPlusConfig";
import type { vscode } from "../src/modules/LeetPlusConfig";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lcex-config-"));
}

function fakeWorkspaceFolder(dir: string) {
  return { uri: { fsPath: dir } } as any;
}

describe("LeetPlusConfig (4a.4)", () => {
  const studyPlans = [{ slug: "top-interview-150" }, { slug: "neetcode-150" }];
  const problemLists = [{ slug: "graph" }, { slug: "dynamic-programming" }];

  describe("inferListSourceForSlug", () => {
    it("slug in studyPlans only → studyPlan", () => {
      expect(inferListSourceForSlug("top-interview-150", studyPlans, problemLists)).toBe("studyPlan");
    });

    it("slug in problemLists only → problemList", () => {
      expect(inferListSourceForSlug("graph", studyPlans, problemLists)).toBe("problemList");
    });

    it("slug in both → studyPlan", () => {
      const shared = [...studyPlans, { slug: "graph" }];
      expect(inferListSourceForSlug("graph", shared, problemLists)).toBe("studyPlan");
    });

    it("slug in neither → studyPlan (default)", () => {
      expect(inferListSourceForSlug("unknown", studyPlans, problemLists)).toBe("studyPlan");
    });
  });

  describe("reconcileListSource", () => {
    it("stale studyPlan → corrected to problemList", () => {
      expect(reconcileListSource("graph", "studyPlan", studyPlans, problemLists)).toBe("problemList");
    });

    it("stale problemList → corrected to studyPlan", () => {
      expect(reconcileListSource("top-interview-150", "problemList", studyPlans, problemLists)).toBe("studyPlan");
    });

    it("source matches → unchanged", () => {
      expect(reconcileListSource("graph", "problemList", studyPlans, problemLists)).toBe("problemList");
      expect(reconcileListSource("top-interview-150", "studyPlan", studyPlans, problemLists)).toBe("studyPlan");
    });
  });

  describe("resolveDefaultStudyPlanSlug", () => {
    it("valid activeStudyPlan → returned", () => {
      expect(resolveDefaultStudyPlanSlug(studyPlans, "neetcode-150")).toBe("neetcode-150");
    });

    it("invalid slug → first plan slug", () => {
      expect(resolveDefaultStudyPlanSlug(studyPlans, "nonexistent")).toBe("top-interview-150");
    });

    it("empty array → hardcoded top-interview-150", () => {
      expect(resolveDefaultStudyPlanSlug([], undefined)).toBe("top-interview-150");
    });
  });

  describe("resolveDefaultProblemListSlug", () => {
    it("valid activeProblemList → returned", () => {
      expect(resolveDefaultProblemListSlug(problemLists, "graph")).toBe("graph");
    });

    it("legacy migration: activeListSource=problemList + activeStudyPlan → migrated slug", () => {
      const result = resolveDefaultProblemListSlug(problemLists, undefined, {
        activeStudyPlan: "dynamic-programming",
        activeListSource: "problemList",
      });
      expect(result).toBe("dynamic-programming");
    });

    it("legacy with invalid slug → falls back to first", () => {
      const result = resolveDefaultProblemListSlug(problemLists, undefined, {
        activeStudyPlan: "nonexistent",
        activeListSource: "problemList",
      });
      expect(result).toBe("graph");
    });
  });

  describe("parseStudyPlans (via parseLeetPlusConfig)", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("invalid entries filtered out, valid ones kept", () => {
      const config = {
        studyPlans: [
          { slug: "valid-plan", name: "Valid Plan" },
          { slug: 123, name: "Bad Slug" },
          { slug: "no-name" },
          { path: "/some/path" },
        ],
      };
      const configDir = path.join(tmpDir, ".leetplus");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify(config));

      const result = parseLeetPlusConfig([fakeWorkspaceFolder(tmpDir)]);
      expect(result.studyPlans).toHaveLength(1);
      expect(result.studyPlans![0].slug).toBe("valid-plan");
    });

    it("empty array → falls back to defaults", () => {
      const config = { studyPlans: [] };
      const configDir = path.join(tmpDir, ".leetplus");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify(config));

      const result = parseLeetPlusConfig([fakeWorkspaceFolder(tmpDir)]);
      expect(result.studyPlans).toHaveLength(1);
      expect(result.studyPlans![0].slug).toBe("top-interview-150");
    });
  });
});
