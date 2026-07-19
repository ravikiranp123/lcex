import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { initDiffLogger, saveDiff, baselineCache } from "../src/modules/DiffLogger";
import { initState } from "../src/modules/StateManager";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-diff-"));
}

const vscode = require("vscode");

function makeProblem(id: number, slug: string) {
  return {
    id,
    title: `Problem ${id}`,
    slug,
    difficulty: "Easy",
    category: "Test",
    status: "pending" as const,
    scheduledDate: new Date().toISOString(),
    nextRepetitionDate: null,
    repetitionLevel: 0,
    completionHistory: [],
    patterns: [],
    leetcodeUrl: null,
    youtubeId: null,
    solutionLink: null,
    hints: null,
    solution: null,
  };
}

function makeEvent(docPath: string, docText: string, changes: any[]) {
  return {
    document: {
      uri: { fsPath: docPath },
      fileName: docPath,
      getText: () => docText,
    },
    contentChanges: changes,
  } as any;
}

describe("DiffLogger", () => {
  let tmpDir: string;
  let originalFolders: any;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalFolders = vscode.workspace.workspaceFolders;
    baselineCache.clear();
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    vscode._clearChangeListeners();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function setupWorkspace(opts?: { enabled?: boolean; triggerMode?: string; charThreshold?: number }) {
    const problem = makeProblem(42, "two-sum");
    await initState(tmpDir, "Plan", [problem]);

    const leetplusDir = path.join(tmpDir, ".leetplus");
    fs.mkdirSync(leetplusDir, { recursive: true });
    fs.writeFileSync(path.join(leetplusDir, "config.json"), JSON.stringify({
      diffLogger: {
        enabled: opts?.enabled ?? true,
        triggerMode: opts?.triggerMode ?? "smart",
        debounceMs: 50,
        charThreshold: opts?.charThreshold ?? 20,
        trackedExtensions: [".ts"],
      },
    }));

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmpDir } }];
    initDiffLogger({ subscriptions: [] } as any);
  }

  it("4a.7.1 — config.enabled=false → no patch files created", async () => {
    await setupWorkspace({ enabled: false });
    const docPath = path.join(tmpDir, "42.ts");

    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "initial", []));
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "changed content ".repeat(5), [{ text: "x", rangeLength: 0 }]));
    await new Promise((r) => setTimeout(r, 100));

    const diffsDir = path.join(tmpDir, ".leetplus", "diffs", "two-sum");
    expect(fs.existsSync(diffsDir)).toBeFalsy();
  });

  it("4a.7.2 — Untracked extension (.rb) → no patch file", async () => {
    await setupWorkspace();
    const docPath = path.join(tmpDir, "42.rb");

    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "initial", []));
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "changed ".repeat(10), [{ text: "x", rangeLength: 0 }]));
    await new Promise((r) => setTimeout(r, 100));

    const diffsDir = path.join(tmpDir, ".leetplus", "diffs", "two-sum");
    expect(fs.existsSync(diffsDir)).toBeFalsy();
  });

  it("4a.7.3 — triggerMode=time → large change doesn't fire immediately", async () => {
    await setupWorkspace({ triggerMode: "time" });
    const docPath = path.join(tmpDir, "42.ts");

    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "original", []));
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "x".repeat(100), [{ text: "x".repeat(100), rangeLength: 0 }]));

    const diffsDir = path.join(tmpDir, ".leetplus", "diffs", "two-sum");
    expect(fs.existsSync(diffsDir)).toBeFalsy();

    await new Promise((r) => setTimeout(r, 100));
    expect(fs.existsSync(diffsDir)).toBeTruthy();
  });

  it("4a.7.4 — triggerMode=change → small change doesn't trigger, large fires immediately", async () => {
    await setupWorkspace({ triggerMode: "change" });
    const docPath = path.join(tmpDir, "42.ts");

    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "original", []));
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "tiny", [{ text: "tiny", rangeLength: 0 }]));

    const diffsDir = path.join(tmpDir, ".leetplus", "diffs", "two-sum");
    expect(fs.existsSync(diffsDir)).toBeFalsy();

    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "x".repeat(100), [{ text: "x".repeat(100), rangeLength: 0 }]));
    expect(fs.existsSync(diffsDir)).toBeTruthy();
  });

  it("4a.7.5 — saveDiff when baseline===current → no patch written", async () => {
    await setupWorkspace();
    const docPath = path.join(tmpDir, "42.ts");
    const text = "function twoSum() {}";
    baselineCache.set(docPath, text);

    await saveDiff(tmpDir, docPath, "two-sum", text);

    const diffsDir = path.join(tmpDir, ".leetplus", "diffs", "two-sum");
    expect(fs.existsSync(diffsDir)).toBeFalsy();
  });

  it("4a.7.6 — baseline updated after save → identical second edit no patch", async () => {
    await setupWorkspace();
    const docPath = path.join(tmpDir, "42.ts");

    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "v1", []));
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "v2-changed-content-here", [{ text: "v2", rangeLength: 0 }]));
    await new Promise((r) => setTimeout(r, 100));

    const diffsDir = path.join(tmpDir, ".leetplus", "diffs", "two-sum");
    const countAfterFirst = fs.readdirSync(diffsDir).length;

    baselineCache.set(docPath, "v2-changed-content-here");
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "v2-changed-content-here", []));
    await new Promise((r) => setTimeout(r, 100));

    expect(fs.readdirSync(diffsDir).length).toBe(countAfterFirst);
  });

  it("4a.7.7 — accumulatedChanges reset after save", async () => {
    await setupWorkspace();
    const docPath = path.join(tmpDir, "42.ts");

    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "v1", []));
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "v2-big-change-here-more-chars", [{ text: "big-change", rangeLength: 0 }]));
    await new Promise((r) => setTimeout(r, 100));

    const diffsDir = path.join(tmpDir, ".leetplus", "diffs", "two-sum");
    expect(fs.existsSync(diffsDir)).toBeTruthy();

    baselineCache.set(docPath, "v2-big-change-here-more-chars");
    await vscode._fireDidChangeTextDocument(makeEvent(docPath, "v2-big-change-here-more-chars", []));
    await new Promise((r) => setTimeout(r, 100));

    const count = fs.readdirSync(diffsDir).length;
    expect(count).toBe(1);
  });
});
