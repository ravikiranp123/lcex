import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import * as vscode from "vscode";
import { archiveStaleReviewSolutionFile, archiveStaleReviewSolutionFilesForPlan } from "../src/modules/ProblemView";
import { initState, readState } from "../src/modules/StateManager";
import * as Database from "../src/modules/Database";

describe("archiveStaleReviewSolutionFile", () => {
  let tmpDir: string;
  let originalFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lcex-archive-"));
    originalFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 },
    ];
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function makeContext(globalState?: Record<string, unknown>): vscode.ExtensionContext {
    return {
      globalState: {
        get: (key: string) => (globalState ? globalState[key] : undefined),
        update: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
  }

  async function seedState(slug: string, id: number, status: "completed" | "pending") {
    await initState(tmpDir, "Test Plan", [
      {
        id,
        title: "Two Sum",
        slug,
        difficulty: "Easy",
        category: "Arrays",
        status,
        scheduledDate: "2026-01-01",
        nextRepetitionDate: todayStr(),
        repetitionLevel: 1,
        completionHistory:
          status === "completed"
            ? [
                {
                  date: "2026-01-01T10:00:00.000Z",
                  rating: 2,
                  notes: "",
                  timeSpentSeconds: 100,
                  hintsUsed: 0,
                  patternsDetected: [],
                },
              ]
            : [],
      },
    ] as any);
  }

  async function solutionPath(slug: string, id: number): Promise<string> {
    const res = await Database.resolveSolutionFilePathForOpen(
      undefined,
      String(id),
      slug,
      undefined,
      undefined,
      "typescript"
    );
    return res.path;
  }

  function writeStaleFile(filePath: string, content = "OLD SOLUTION") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf-8");
    const old = new Date(Date.now() - 3 * 86400_000);
    fs.utimesSync(filePath, old, old);
  }

  function archiveName(filePath: string): string {
    const ext = path.extname(filePath);
    return filePath.slice(0, filePath.length - ext.length) + "." + todayStr() + ext;
  }

  it("archives a stale solution file for a completed (review) problem", async () => {
    await seedState("two-sum", 1, "completed");
    const originalPath = await solutionPath("two-sum", 1);
    writeStaleFile(originalPath, "OLD SOLUTION");

    const result = await archiveStaleReviewSolutionFile(
      makeContext(),
      { id: 1, titleSlug: "two-sum" },
      "typescript"
    );

    expect(result).toBe(true);
    expect(fs.existsSync(originalPath)).toBe(false);
    const archivedPath = archiveName(originalPath);
    expect(fs.existsSync(archivedPath)).toBe(true);
    expect(fs.readFileSync(archivedPath, "utf-8")).toBe("OLD SOLUTION");
  });

  it("does not archive a file updated today", async () => {
    await seedState("two-sum", 1, "completed");
    const filePath = await solutionPath("two-sum", 1);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "IN PROGRESS");
    fs.utimesSync(filePath, new Date(), new Date());

    const result = await archiveStaleReviewSolutionFile(
      makeContext(),
      { id: 1, titleSlug: "two-sum" },
      "typescript"
    );

    expect(result).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.existsSync(archiveName(filePath))).toBe(false);
  });

  it("does not archive when the problem is pending in state", async () => {
    await seedState("two-sum", 1, "pending");
    const filePath = await solutionPath("two-sum", 1);
    writeStaleFile(filePath);

    const result = await archiveStaleReviewSolutionFile(
      makeContext(),
      { id: 1, titleSlug: "two-sum" },
      "typescript"
    );

    expect(result).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("does not archive when the problem is not in state", async () => {
    await seedState("other-slug", 999, "completed");
    const filePath = await solutionPath("two-sum", 1);
    writeStaleFile(filePath);

    const result = await archiveStaleReviewSolutionFile(
      makeContext(),
      { id: 1, titleSlug: "two-sum" },
      "typescript"
    );

    expect(result).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("does not archive when no solution file exists", async () => {
    await seedState("two-sum", 1, "completed");
    vi.spyOn(vscode.workspace.fs, "stat").mockRejectedValue(new Error("ENOENT"));

    const result = await archiveStaleReviewSolutionFile(
      makeContext(),
      { id: 1, titleSlug: "two-sum" },
      "typescript"
    );

    expect(result).toBe(false);
  });

  it("does not archive in interview mode", async () => {
    await seedState("two-sum", 1, "completed");
    const filePath = await solutionPath("two-sum", 1);
    writeStaleFile(filePath);
    const context = makeContext({
      "leetplus.interviewSession": {
        active: true,
        startedAt: Date.now(),
        endsAt: Date.now() + 3600_000,
        attemptHex: "a1b",
        solutionFolderPath: tmpDir,
      },
    });

    const result = await archiveStaleReviewSolutionFile(
      context,
      { id: 1, titleSlug: "two-sum" },
      "typescript"
    );

    expect(result).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("picks a suffixed archive name when today's archive file already exists", async () => {
    await seedState("two-sum", 1, "completed");
    const filePath = await solutionPath("two-sum", 1);
    writeStaleFile(filePath);
    fs.writeFileSync(archiveName(filePath), "EARLIER ARCHIVE", "utf-8");

    const result = await archiveStaleReviewSolutionFile(
      makeContext(),
      { id: 1, titleSlug: "two-sum" },
      "typescript"
    );

    expect(result).toBe(true);
    expect(fs.existsSync(archiveName(filePath))).toBe(true);
    expect(fs.readFileSync(archiveName(filePath), "utf-8")).toBe("EARLIER ARCHIVE");
    const ext = path.extname(filePath);
    const suffixed = filePath.slice(0, filePath.length - ext.length) + "." + todayStr() + "-2" + ext;
    expect(fs.existsSync(suffixed)).toBe(true);
    expect(fs.readFileSync(suffixed, "utf-8")).toBe("OLD SOLUTION");
  });
});

describe("archiveStaleReviewSolutionFilesForPlan", () => {
  let tmpDir: string;
  let originalFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lcex-archive-bulk-"));
    originalFolders = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 },
    ];
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function makeContext(globalState?: Record<string, unknown>): vscode.ExtensionContext {
    return {
      globalState: {
        get: (key: string) => (globalState ? globalState[key] : undefined),
        update: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
  }

  async function solutionPath(slug: string, id: number): Promise<string> {
    const res = await Database.resolveSolutionFilePathForOpen(
      undefined,
      String(id),
      slug,
      undefined,
      undefined,
      "typescript"
    );
    return res.path;
  }

  function writeStaleFile(filePath: string, content = "OLD SOLUTION") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf-8");
    const old = new Date(Date.now() - 3 * 86400_000);
    fs.utimesSync(filePath, old, old);
  }

  function archiveName(filePath: string): string {
    const ext = path.extname(filePath);
    return filePath.slice(0, filePath.length - ext.length) + "." + todayStr() + ext;
  }

  it("archives only stale rep items", async () => {
    await initState(tmpDir, "Test Plan", [
      {
        id: 1,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays",
        status: "completed",
        scheduledDate: "2026-01-01",
        nextRepetitionDate: todayStr(),
        repetitionLevel: 1,
        completionHistory: [
          {
            date: "2026-01-01T10:00:00.000Z",
            rating: 2,
            notes: "",
            timeSpentSeconds: 100,
            hintsUsed: 0,
            patternsDetected: [],
          },
        ],
      },
      {
        id: 2,
        title: "Add Two Numbers",
        slug: "add-two-numbers",
        difficulty: "Medium",
        category: "Linked List",
        status: "pending",
        scheduledDate: "2026-01-01",
        nextRepetitionDate: todayStr(),
        repetitionLevel: 0,
        completionHistory: [],
      },
    ] as any);

    const state = (await readState(tmpDir))!;
    const file1 = await solutionPath("two-sum", 1);
    const file2 = await solutionPath("add-two-numbers", 2);
    writeStaleFile(file1, "SOLUTION 1");
    writeStaleFile(file2, "SOLUTION 2");

    const planItems = [
      { id: 1, type: "rep" as const },
      { id: 2, type: "new" as const },
    ];

    const count = await archiveStaleReviewSolutionFilesForPlan(makeContext(), state, planItems);

    expect(count).toBe(1);
    expect(fs.existsSync(file1)).toBe(false);
    expect(fs.existsSync(archiveName(file1))).toBe(true);
    expect(fs.existsSync(file2)).toBe(true);
    expect(fs.existsSync(archiveName(file2))).toBe(false);
  });

  it("skips a stale rep item whose problem is not in state", async () => {
    await initState(tmpDir, "Test Plan", [] as any);
    const state = (await readState(tmpDir))!;
    const planItems = [{ id: 999, type: "rep" as const }];

    const count = await archiveStaleReviewSolutionFilesForPlan(makeContext(), state, planItems);

    expect(count).toBe(0);
  });

  it("does not archive a rep item whose file was updated today", async () => {
    await initState(tmpDir, "Test Plan", [
      {
        id: 1,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays",
        status: "completed",
        scheduledDate: "2026-01-01",
        nextRepetitionDate: todayStr(),
        repetitionLevel: 1,
        completionHistory: [
          {
            date: "2026-01-01T10:00:00.000Z",
            rating: 2,
            notes: "",
            timeSpentSeconds: 100,
            hintsUsed: 0,
            patternsDetected: [],
          },
        ],
      },
    ] as any);

    const state = (await readState(tmpDir))!;
    const file1 = await solutionPath("two-sum", 1);
    fs.mkdirSync(path.dirname(file1), { recursive: true });
    fs.writeFileSync(file1, "TODAY SOLUTION", "utf-8");
    fs.utimesSync(file1, new Date(), new Date());

    const planItems = [{ id: 1, type: "rep" as const }];

    const count = await archiveStaleReviewSolutionFilesForPlan(makeContext(), state, planItems);

    expect(count).toBe(0);
    expect(fs.existsSync(file1)).toBe(true);
    expect(fs.existsSync(archiveName(file1))).toBe(false);
  });

  it("returns 0 for an empty plan", async () => {
    await initState(tmpDir, "Test Plan", [] as any);
    const state = (await readState(tmpDir))!;
    const planItems: Array<{ id: number; type: "rep" | "new" }> = [];

    const count = await archiveStaleReviewSolutionFilesForPlan(makeContext(), state, planItems);

    expect(count).toBe(0);
  });
});
