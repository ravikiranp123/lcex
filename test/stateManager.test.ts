import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { readState, writeState, initState } from "../src/modules/StateManager";
import type { LPState } from "../src/modules/interface/LPState";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-state-"));
}

const MINIMAL_STATE: LPState = {
  version: "1.0",
  planName: "Test Plan",
  startDate: new Date().toISOString(),
  problems: [],
  currentStreak: 0,
  bestStreak: 0,
  lastActivityDate: null,
  patternMastery: {},
  designProblems: [],
  behavioralStories: [],
};

describe("StateManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("write then read round-trips correctly", async () => {
    await writeState(tmpDir, MINIMAL_STATE);
    const read = await readState(tmpDir);
    expect(read).toBeTruthy();
    expect(read.version).toBe("1.0");
  });

  it("initState creates state with correct planName", async () => {
    const state = await initState(tmpDir, "Custom Study Plan", []);
    expect(state.planName).toBe("Custom Study Plan");
    const read = await readState(tmpDir);
    expect(read.planName).toBe("Custom Study Plan");
  });

  describe("readState edge cases", () => {
    it("returns null when state.json does not exist", async () => {
      const result = await readState(tmpDir);
      expect(result).toBeNull();
    });

    it("returns null for invalid JSON content", async () => {
      const dir = path.join(tmpDir, ".leetplus");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "state.json"), "{ corrupted!!!", "utf-8");
      expect(await readState(tmpDir)).toBeNull();
    });

    it("returns null for valid JSON missing version field", async () => {
      const dir = path.join(tmpDir, ".leetplus");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ problems: [] }), "utf-8");
      expect(await readState(tmpDir)).toBeNull();
    });

    it("returns null for valid JSON where problems is not an array", async () => {
      const dir = path.join(tmpDir, ".leetplus");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ version: "1.0", problems: "bad" }), "utf-8");
      expect(await readState(tmpDir)).toBeNull();
    });
  });

  describe("writeState", () => {
    it("creates .leetplus/ dir if it does not exist", async () => {
      const nested = path.join(tmpDir, "deep", "workspace");
      fs.mkdirSync(nested, { recursive: true });
      await writeState(nested, MINIMAL_STATE);
      expect(fs.existsSync(path.join(nested, ".leetplus", "state.json"))).toBeTruthy();
    });

    it("leaves no .tmp file on disk after write", async () => {
      await writeState(tmpDir, MINIMAL_STATE);
      const dir = path.join(tmpDir, ".leetplus");
      const files = fs.readdirSync(dir);
      expect(files.some((f) => f.endsWith(".tmp"))).toBeFalsy();
    });

    it("uses 2-space indentation in written file", async () => {
      await writeState(tmpDir, MINIMAL_STATE);
      const raw = fs.readFileSync(path.join(tmpDir, ".leetplus", "state.json"), "utf-8");
      const lines = raw.split("\n");
      const indentedLine = lines.find((l) => l.startsWith("  ") && !l.startsWith("   "));
      expect(indentedLine).toBeTruthy();
    });
  });

  describe("initState", () => {
    it("sets planSlug when provided", async () => {
      const state = await initState(tmpDir, "Plan", [], "neetcode-150");
      expect(state.planSlug).toBe("neetcode-150");
      const read = await readState(tmpDir);
      expect(read.planSlug).toBe("neetcode-150");
    });

    it("writes all problems from the array", async () => {
      const problems = [
        { ...MINIMAL_STATE.problems[0], id: 1, title: "A" } as any,
        { ...MINIMAL_STATE.problems[0], id: 2, title: "B" } as any,
      ];
      const state = await initState(tmpDir, "Plan", problems);
      expect(state.problems).toHaveLength(2);
      const read = await readState(tmpDir);
      expect(read.problems).toHaveLength(2);
    });
  });
});
