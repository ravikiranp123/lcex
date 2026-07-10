import { describe, it } from "node:test";
import assert from "node:assert";
import { parseConfig, configToJson } from "../src/modules/LeetPlusConfigEditor";

describe("LeetPlusConfigEditor", () => {
  it("should parse default configuration values for empty input", () => {
    const config = parseConfig("");
    assert.strictEqual(config.theme, "auto");
    assert.strictEqual(config.srs?.enabled, true);
    assert.strictEqual(config.srs?.problemsPerDay, 5);
    assert.strictEqual(config.srs?.defaultMode, "interleaved");
    assert.deepStrictEqual(config.srs?.intervals, [1, 7, 16, 35, 90]);
    assert.strictEqual(config.diffLogger?.enabled, true);
    assert.strictEqual(config.diffLogger?.triggerMode, "smart");
    assert.strictEqual(config.diffLogger?.debounceMs, 10000);
    assert.strictEqual(config.diffLogger?.charThreshold, 100);
    assert.deepStrictEqual(config.diffLogger?.trackedExtensions, [".py", ".ts", ".js", ".cpp", ".java", ".go"]);
    assert.strictEqual(config.autoRating?.enabled, true);
    assert.strictEqual(config.autoRating?.requireConfirmation, true);
    assert.strictEqual(config.diffRetention, "session");
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
    assert.strictEqual(config.theme, "leetcode-dark");
    assert.strictEqual(config.srs?.enabled, false);
    assert.strictEqual(config.srs?.problemsPerDay, 8);
    assert.strictEqual(config.srs?.defaultMode, "push");
    assert.deepStrictEqual(config.srs?.intervals, [3, 10, 30]);

    assert.strictEqual(config.diffLogger?.enabled, false);
    assert.strictEqual(config.diffLogger?.triggerMode, "change");
    assert.strictEqual(config.diffLogger?.debounceMs, 5000);
    assert.strictEqual(config.diffLogger?.charThreshold, 50);
    assert.deepStrictEqual(config.diffLogger?.trackedExtensions, [".py"]);

    assert.strictEqual(config.autoRating?.enabled, false);
    assert.strictEqual(config.autoRating?.requireConfirmation, false);
    assert.strictEqual(config.diffRetention, "all");
  });
});
