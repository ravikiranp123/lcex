import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { initStatusBar, updateStatusBar } from "../src/modules/StatusBarManager";
import { initState } from "../src/modules/StateManager";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-statusbar-"));
}

function getLastStatusBarItem() {
  const vscode = require("vscode");
  return vscode._statusBarItems[vscode._statusBarItems.length - 1];
}

describe("StatusBarManager", () => {
  const vscode = require("vscode");
  let tmpDir: string;
  let originalFolders: any;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalFolders = vscode.workspace.workspaceFolders;
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updateStatusBar when statusBarItem not initialized → no throw", async () => {
    vscode.workspace.workspaceFolders = undefined;
    await expect(updateStatusBar()).resolves.not.toThrow();
  });

  it("updateStatusBar with no workspace folders → hide() called", async () => {
    initStatusBar({ subscriptions: [] } as any);
    vscode.workspace.workspaceFolders = undefined;
    const item = getLastStatusBarItem();
    const hideSpy = vi.spyOn(item, "hide");

    await updateStatusBar();
    expect(hideSpy).toHaveBeenCalled();
  });

  it("updateStatusBar with workspace folder but no .leetplus dir → hide() called", async () => {
    initStatusBar({ subscriptions: [] } as any);
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmpDir } }];
    const item = getLastStatusBarItem();
    const hideSpy = vi.spyOn(item, "hide");

    await updateStatusBar();
    expect(hideSpy).toHaveBeenCalled();
  });

  it("updateStatusBar when readState returns null → hide() called", async () => {
    initStatusBar({ subscriptions: [] } as any);
    fs.mkdirSync(path.join(tmpDir, ".leetplus"), { recursive: true });
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmpDir } }];
    const item = getLastStatusBarItem();
    const hideSpy = vi.spyOn(item, "hide");

    await updateStatusBar();
    expect(hideSpy).toHaveBeenCalled();
  });

  it("streak=0, dueCount=0 → text is '🔥 0 | 📋 0 due', show() called", async () => {
    initStatusBar({ subscriptions: [] } as any);
    await initState(tmpDir, "Plan", []);
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmpDir } }];
    const item = getLastStatusBarItem();
    const showSpy = vi.spyOn(item, "show");

    await updateStatusBar();
    expect(item.text).toBe("🔥 0 | 📋 0 due");
    expect(showSpy).toHaveBeenCalled();
  });

  it("non-zero streak → displayed correctly", async () => {
    initStatusBar({ subscriptions: [] } as any);
    const state = await initState(tmpDir, "Plan", []);
    state.currentStreak = 7;
    const { writeState } = await import("../src/modules/StateManager");
    await writeState(tmpDir, state);

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmpDir } }];
    await updateStatusBar();
    expect(getLastStatusBarItem().text).toContain("🔥 7");
  });

  it("multiple due problems → count shown correctly", async () => {
    initStatusBar({ subscriptions: [] } as any);
    const problems = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      title: `Problem ${i}`,
      slug: `p-${i}`,
      difficulty: "Easy",
      category: "Test",
      status: "pending" as const,
      scheduledDate: new Date(Date.now() - 3600 * 1000).toISOString(),
      nextRepetitionDate: null,
      repetitionLevel: 0,
      completionHistory: [],
      patterns: [],
      leetcodeUrl: null,
      youtubeId: null,
      solutionLink: null,
      hints: null,
      solution: null,
    }));
    await initState(tmpDir, "Plan", problems);

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmpDir } }];
    await updateStatusBar();
    expect(getLastStatusBarItem().text).toBe("🔥 0 | 📋 3 due");
  });
});
