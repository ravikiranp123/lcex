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
});
