import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initializeWorkspaceFolder } from "../src/modules/WorkspaceInitializer";
import { readState } from "../src/modules/StateManager";

const SUBDIRS = ["snapshots", "diffs", "guides", "designs", "behavioral", "plans", "whiteboard"];

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lcex-ws-init-"));
}

describe("Workspace initialization", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .leetplus/ and all 7 subdirs in a fresh workspace", async () => {
    const result = await initializeWorkspaceFolder(tmpDir);

    expect(result.created).toBeTruthy();
    const leetplusDir = path.join(tmpDir, ".leetplus");
    expect(fs.existsSync(leetplusDir)).toBeTruthy();
    expect(fs.statSync(leetplusDir).isDirectory()).toBeTruthy();

    for (const d of SUBDIRS) {
      expect(fs.existsSync(path.join(leetplusDir, d))).toBeTruthy();
      expect(fs.statSync(path.join(leetplusDir, d)).isDirectory()).toBeTruthy();
    }
    expect(result.subdirsCreated).toEqual(SUBDIRS);
  });

  it("creates config.json with default content", async () => {
    await initializeWorkspaceFolder(tmpDir);

    const configPath = path.join(tmpDir, ".leetplus", "config.json");
    expect(fs.existsSync(configPath)).toBeTruthy();

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.language).toBe("typescript");
  });

  it("initializes state.json", async () => {
    await initializeWorkspaceFolder(tmpDir);

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();
    expect(state!.version).toBe("1.0");
    expect(state!.problems).toEqual([]);
    expect(state!.planName).toBe("My Practice Plan");
  });

  it("does not overwrite existing config.json on re-init", async () => {
    await initializeWorkspaceFolder(tmpDir);

    const configPath = path.join(tmpDir, ".leetplus", "config.json");
    fs.writeFileSync(configPath, JSON.stringify({ language: "python" }, null, 2), "utf-8");

    const result = await initializeWorkspaceFolder(tmpDir);

    expect(result.created).toBeFalsy();
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.language).toBe("python");
  });

  it("creates missing subdirs while leaving existing ones untouched", async () => {
    await initializeWorkspaceFolder(tmpDir);

    const leetplusDir = path.join(tmpDir, ".leetplus");
    const snapshotsDir = path.join(leetplusDir, "snapshots");
    const markerFile = path.join(snapshotsDir, "keep-me.txt");
    fs.writeFileSync(markerFile, "preset", "utf-8");
    const origMtime = fs.statSync(snapshotsDir).mtimeMs;

    fs.rmSync(path.join(leetplusDir, "guides"), { recursive: true, force: true });

    const result = await initializeWorkspaceFolder(tmpDir);

    expect(fs.existsSync(path.join(leetplusDir, "guides"))).toBeTruthy();
    expect(result.subdirsCreated).toContain("guides");
    expect(fs.readFileSync(markerFile, "utf-8")).toBe("preset");
    expect(fs.statSync(snapshotsDir).mtimeMs).toBe(origMtime);
  });

  it("converts .leetplus file to directory with config from file content", async () => {
    const leetplusPath = path.join(tmpDir, ".leetplus");
    fs.writeFileSync(leetplusPath, '{"language":"go"}', "utf-8");

    const result = await initializeWorkspaceFolder(tmpDir);

    expect(result.convertedFileToDir).toBeTruthy();
    expect(fs.statSync(leetplusPath).isDirectory()).toBeTruthy();

    for (const d of SUBDIRS) {
      expect(fs.existsSync(path.join(leetplusPath, d))).toBeTruthy();
    }

    const config = JSON.parse(fs.readFileSync(path.join(leetplusPath, "config.json"), "utf-8"));
    expect(config.language).toBe("go");
    expect(result.configContent).toBe('{"language":"go"}');

    expect(fs.existsSync(path.join(leetplusPath, "state.json"))).toBeFalsy();
  });

  it("migrates legacy .leetcode file", async () => {
    const leetcodePath = path.join(tmpDir, ".leetcode");
    fs.writeFileSync(leetcodePath, '{"language":"rust"}', "utf-8");

    const result = await initializeWorkspaceFolder(tmpDir);

    expect(result.migratedFromLegacy).toBeTruthy();
    expect(result.created).toBeTruthy();
    expect(fs.existsSync(leetcodePath)).toBeFalsy();

    const configPath = path.join(tmpDir, ".leetplus", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.language).toBe("rust");

    const state = await readState(tmpDir);
    expect(state).toBeTruthy();
    expect(state!.version).toBe("1.0");
  });

  it("repairs missing state.json in existing directory", async () => {
    await initializeWorkspaceFolder(tmpDir);

    const statePath = path.join(tmpDir, ".leetplus", "state.json");
    fs.unlinkSync(statePath);

    const result = await initializeWorkspaceFolder(tmpDir);

    expect(result.stateRepaired).toBeTruthy();
    const state = await readState(tmpDir);
    expect(state).toBeTruthy();
    expect(state!.version).toBe("1.0");
  });
});
