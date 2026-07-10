import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { readState } from "./StateManager";
import { getDueProblems } from "./SRSEngine";

let statusBarItem: vscode.StatusBarItem | null = null;
let fileWatcher: vscode.FileSystemWatcher | null = null;

/**
 * Initializes the LeetPlus status bar item.
 */
export function initStatusBar(context: vscode.ExtensionContext): void {
  // Create status bar item with alignment Left, priority 100
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "leetplus.showDailyPlan";
  statusBarItem.tooltip = "LeetPlus Daily Progress & Reviews";
  context.subscriptions.push(statusBarItem);

  // Register command leetplus.showDailyPlan
  context.subscriptions.push(
    vscode.commands.registerCommand("leetplus.showDailyPlan", () => {
      vscode.window.showInformationMessage(
        "Daily practice plan is being loaded... (View implementation in upcoming Phase 3)."
      );
    })
  );

  // Watch for state changes reactively
  setupStateWatcher(context);

  // Initial update
  void updateStatusBar();
}

/**
 * Sets up a file system watcher for state.json changes.
 */
function setupStateWatcher(context: vscode.ExtensionContext): void {
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  // Create watcher targeting state.json in any subfolder (e.g. .leetplus/state.json)
  fileWatcher = vscode.workspace.createFileSystemWatcher("**/.leetplus/state.json");
  
  const triggerUpdate = () => void updateStatusBar();
  fileWatcher.onDidChange(triggerUpdate);
  fileWatcher.onDidCreate(triggerUpdate);
  fileWatcher.onDidDelete(triggerUpdate);

  context.subscriptions.push(fileWatcher);

  // Also update when active workspace folder list changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(triggerUpdate)
  );
}

/**
 * Updates the status bar text and visibility based on the current LeetPlus state.
 */
export async function updateStatusBar(): Promise<void> {
  if (!statusBarItem) return;

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    statusBarItem.hide();
    return;
  }

  // Find a workspace folder containing .leetplus folder
  const workspaceRoot = folders.find(f => {
    const p = f.uri.fsPath;
    return fs.existsSync(path.join(p, ".leetplus"));
  })?.uri.fsPath;

  if (!workspaceRoot) {
    statusBarItem.hide();
    return;
  }

  try {
    const state = await readState(workspaceRoot);
    if (!state) {
      statusBarItem.hide();
      return;
    }

    const streak = state.currentStreak ?? 0;
    const dueCount = getDueProblems(state).length;

    statusBarItem.text = `🔥 ${streak} | 📋 ${dueCount} due`;
    statusBarItem.show();
  } catch {
    statusBarItem.hide();
  }
}
