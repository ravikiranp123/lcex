import { describe, it, expect } from "vitest";
import { parseConfig, configToJson } from "../src/modules/LeetPlusConfigEditor";

describe("LeetPlusConfigEditor", () => {
  it("should parse default configuration values for empty input", () => {
    const config = parseConfig("");
    expect(config.theme).toBe("auto");
    expect(config.srs?.enabled).toBe(true);
    expect(config.srs?.problemsPerDay).toBe(5);
    expect(config.srs?.defaultMode).toBe("interleaved");
    expect(config.srs?.intervals).toEqual([1, 7, 16, 35, 90]);
    expect(config.diffLogger?.enabled).toBe(true);
    expect(config.diffLogger?.triggerMode).toBe("smart");
    expect(config.diffLogger?.debounceMs).toBe(10000);
    expect(config.diffLogger?.charThreshold).toBe(100);
    expect(config.diffLogger?.trackedExtensions).toEqual([".py", ".ts", ".js", ".cpp", ".java", ".go"]);
    expect(config.autoRating?.enabled).toBe(true);
    expect(config.autoRating?.requireConfirmation).toBe(true);
    expect(config.diffRetention).toBe("session");
  });

  it("should parse custom srs and diffLogger settings successfully", () => {
    const rawJson = JSON.stringify({
      theme: "leetcode-dark",
      srs: {
        enabled: false,
        problemsPerDay: 8,
        defaultMode: "push",
        intervals: [3, 10, 30]
      },
      diffLogger: {
        enabled: false,
        triggerMode: "change",
        debounceMs: 5000,
        charThreshold: 50,
        trackedExtensions: [".py"]
      },
      autoRating: {
        enabled: false,
        requireConfirmation: false
      },
      diffRetention: "all"
    });

    const config = parseConfig(rawJson);
    expect(config.theme).toBe("leetcode-dark");
    expect(config.srs?.enabled).toBe(false);
    expect(config.srs?.problemsPerDay).toBe(8);
    expect(config.srs?.defaultMode).toBe("push");
    expect(config.srs?.intervals).toEqual([3, 10, 30]);

    expect(config.diffLogger?.enabled).toBe(false);
    expect(config.diffLogger?.triggerMode).toBe("change");
    expect(config.diffLogger?.debounceMs).toBe(5000);
    expect(config.diffLogger?.charThreshold).toBe(50);
    expect(config.diffLogger?.trackedExtensions).toEqual([".py"]);

    expect(config.autoRating?.enabled).toBe(false);
    expect(config.autoRating?.requireConfirmation).toBe(false);
    expect(config.diffRetention).toBe("all");
  });

  it("parseConfig with invalid JSON → returns DEFAULTS without throwing", () => {
    const config = parseConfig("{not valid json!!!");
    expect(config.theme).toBe("auto");
    expect(config.srs?.enabled).toBe(true);
    expect(config.srs?.defaultMode).toBe("interleaved");
    expect(config.diffRetention).toBe("session");
  });

  it("parseConfig with whitespace-only input → returns DEFAULTS", () => {
    const config = parseConfig("   \n  \t  ");
    expect(config.theme).toBe("auto");
    expect(config.srs?.defaultMode).toBe("interleaved");
  });

  it("parseConfig with studyPlans: [] (empty array) → falls back to DEFAULTS.studyPlans", () => {
    const config = parseConfig(JSON.stringify({ studyPlans: [] }));
    expect(config.studyPlans).toEqual([{ slug: "top-interview-150", name: "Top Interview 150" }]);
  });

  it("parseConfig with studyPlans containing entries missing slug → invalid entries filtered out", () => {
    const config = parseConfig(JSON.stringify({
      studyPlans: [
        { slug: "valid-plan", name: "Valid" },
        { name: "No Slug" },
        { slug: 123, name: "Wrong Type" },
      ]
    }));
    expect(config.studyPlans?.length).toBe(1);
    expect(config.studyPlans?.[0].slug).toBe("valid-plan");
  });

  it("parseConfig with unsupported language (e.g. rust) → falls back to default language", () => {
    const config = parseConfig(JSON.stringify({ language: "rust" }));
    expect(config.language).toBe("typescript");
  });

  it("parseConfig with invalid srs.defaultMode → falls back to interleaved", () => {
    const config = parseConfig(JSON.stringify({ srs: { defaultMode: "invalid-mode" } }));
    expect(config.srs?.defaultMode).toBe("interleaved");
  });

  it("parseConfig with invalid diffRetention → falls back to session", () => {
    const config = parseConfig(JSON.stringify({ diffRetention: "invalid" }));
    expect(config.diffRetention).toBe("session");
  });

  it("configToJson round-trip: parse → serialize → valid JSON with 2-space indent", () => {
    const input = JSON.stringify({ theme: "none", srs: { enabled: false } });
    const config = parseConfig(input);
    const json = configToJson(config);
    const parsed = JSON.parse(json);
    expect(parsed.theme).toBe("none");
    expect(parsed.srs?.enabled).toBe(false);
    expect(json).toContain("  ");
    expect(json).not.toContain("\t");
  });
});
