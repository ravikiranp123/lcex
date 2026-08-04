import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { execSync } from "child_process";
import { readState, writeState } from "./StateManager";
import { problemKeyFromSolutionFileBase } from "./language/LanguageStrategy";

// Configuration interface
export interface DiffLoggerConfig {
  enabled: boolean;
  triggerMode: "smart" | "time" | "change";
  debounceMs: number;
  charThreshold: number;
  trackedExtensions: string[];
}

const DEFAULT_CONFIG: DiffLoggerConfig = {
  enabled: true,
  triggerMode: "smart",
  debounceMs: 10000,
  charThreshold: 100,
  trackedExtensions: [".py", ".ts", ".js", ".cpp", ".java", ".go"]
};

// In-memory caches for tracking changes
export const baselineCache = new Map<string, string>();
const debounceTimers = new Map<string, NodeJS.Timeout>();
const accumulatedChanges = new Map<string, number>();

/**
 * Loads diffLogger config overrides from .leetplus/config.json
 */
function getDiffLoggerConfig(workspaceRoot: string): DiffLoggerConfig {
  const configPath = path.join(workspaceRoot, ".leetplus", "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const userConfig = parsed.diffLogger || {};
      return {
        enabled: userConfig.enabled !== false,
        triggerMode: userConfig.triggerMode || DEFAULT_CONFIG.triggerMode,
        debounceMs: typeof userConfig.debounceMs === "number" ? userConfig.debounceMs : DEFAULT_CONFIG.debounceMs,
        charThreshold: typeof userConfig.charThreshold === "number" ? userConfig.charThreshold : DEFAULT_CONFIG.charThreshold,
        trackedExtensions: Array.isArray(userConfig.trackedExtensions) ? userConfig.trackedExtensions : DEFAULT_CONFIG.trackedExtensions
      };
    } catch {
      // Ignore JSON parse errors and return defaults
    }
  }
  return DEFAULT_CONFIG;
}

import * as Logger from "./Logger";

/**
 * Finds a matching problem in LPState for a given solution file path.
 * Supports filenames in all patterns: "217.py", "contains-duplicate.py",
 * "217.contains-duplicate.py", "217-contains-duplicate.py", "217_contains_duplicate.py",
 * and "LeetPlusMain217.java".
 */
export function findProblemForDocument(state: LPState, docPath: string): LPProblem | undefined {
  if (!state || !state.problems || state.problems.length === 0) return undefined;

  const ext = path.extname(docPath);
  const base = path.basename(docPath, ext);
  const key = problemKeyFromSolutionFileBase(base);

  // 1. Direct match: numeric ID or exact slug
  const directNum = Number(key);
  if (!isNaN(directNum)) {
    const p = state.problems.find((prob) => prob.id === directNum);
    if (p) return p;
  }
  const directSlug = state.problems.find((prob) => prob.slug === key);
  if (directSlug) return directSlug;

  // 2. Handle "id.slug" format (e.g. "217.contains-duplicate" or "1.two-sum")
  if (key.includes(".")) {
    const parts = key.split(".");
    const firstNum = Number(parts[0]);
    const restSlug = parts.slice(1).join(".");
    const p = state.problems.find(
      (prob) => (!isNaN(firstNum) && prob.id === firstNum) || (restSlug && prob.slug === restSlug)
    );
    if (p) return p;
  }

  // 3. Handle "id-slug" or "id_slug" formats (e.g. "217-contains-duplicate" or "217_contains_duplicate")
  const match = key.match(/^(\d+)[-_](.+)$/);
  if (match) {
    const idNum = Number(match[1]);
    const slugStr = match[2].replace(/_/g, "-");
    const p = state.problems.find(
      (prob) => prob.id === idNum || prob.slug === slugStr || prob.slug === match[2]
    );
    if (p) return p;
  }

  return undefined;
}

/**
 * Initializes the DiffLogger document change and save listeners.
 */
export function initDiffLogger(context: vscode.ExtensionContext): void {
  // Seed baseline when a document is opened
  if (typeof vscode.workspace.onDidOpenTextDocument === "function") {
    const openListener = vscode.workspace.onDidOpenTextDocument((doc) => {
      const docPath = doc.uri.fsPath;
      if (!baselineCache.has(docPath)) {
        baselineCache.set(docPath, doc.getText());
        accumulatedChanges.set(docPath, 0);
      }
    });
    context.subscriptions.push(openListener);
  }

  // Register text document change event listener
  if (typeof vscode.workspace.onDidChangeTextDocument === "function") {
    const changeListener = vscode.workspace.onDidChangeTextDocument(async (e) => {
      await handleDocumentChange(e);
    });
    context.subscriptions.push(changeListener);
  }

  // Immediately save diff on document save
  if (typeof vscode.workspace.onDidSaveTextDocument === "function") {
    const saveListener = vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const docPath = doc.uri.fsPath;
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) return;
      const folder = folders.find((f) => docPath.startsWith(f.uri.fsPath));
      if (!folder) return;
      const workspaceRoot = folder.uri.fsPath;

      const config = getDiffLoggerConfig(workspaceRoot);
      if (!config.enabled) return;

      const ext = path.extname(docPath).toLowerCase();
      if (!config.trackedExtensions.map((x) => x.toLowerCase()).includes(ext)) return;

      const state = await readState(workspaceRoot);
      if (!state) return;

      const problem = findProblemForDocument(state, docPath);
      if (!problem) return;

      const currentText = doc.getText();
      const baselineText = baselineCache.get(docPath);
      if (baselineText !== undefined && currentText !== baselineText) {
        void saveDiff(workspaceRoot, docPath, problem.slug || String(problem.id), currentText);
      }
    });
    context.subscriptions.push(saveListener);
  }

  // Clean up timers on extension dispose
  context.subscriptions.push({
    dispose: () => {
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      baselineCache.clear();
      accumulatedChanges.clear();
    },
  });
}

/**
 * Main handler for document changes.
 */
async function handleDocumentChange(e: vscode.TextDocumentChangeEvent): Promise<void> {
  const doc = e.document;
  const docPath = doc.uri.fsPath;
  const ext = path.extname(docPath).toLowerCase();

  // 1. Check workspace folders
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;

  // Resolve matching workspace folder root
  const folder = folders.find((f) => docPath.startsWith(f.uri.fsPath));
  if (!folder) return;
  const workspaceRoot = folder.uri.fsPath;

  // 2. Read diffLogger config
  const config = getDiffLoggerConfig(workspaceRoot);
  if (!config.enabled) return;

  // 3. Verify file extension is tracked
  if (!config.trackedExtensions.map((x) => x.toLowerCase()).includes(ext)) {
    return;
  }

  // 4. Resolve problem from active state.json
  const state = await readState(workspaceRoot);
  if (!state) return;

  const problem = findProblemForDocument(state, docPath);
  if (!problem) return;

  const currentText = doc.getText();

  // 5. Initialize baseline if not cached
  if (!baselineCache.has(docPath)) {
    baselineCache.set(docPath, currentText);
    accumulatedChanges.set(docPath, 0);
  }

  const baselineText = baselineCache.get(docPath) ?? "";
  if (currentText === baselineText) return;

  // 6. Accumulate change counts
  const changes = e.contentChanges.reduce((sum, c) => sum + c.text.length + c.rangeLength, 0);
  const currentAccumulated = (accumulatedChanges.get(docPath) ?? 0) + changes;
  accumulatedChanges.set(docPath, currentAccumulated);

  // 7. Evaluate trigger modes
  const triggerSave = () => {
    void saveDiff(workspaceRoot, docPath, problem.slug || String(problem.id), currentText);
  };

  const mode = config.triggerMode;
  let didTrigger = false;

  // Change count trigger
  if ((mode === "smart" || mode === "change") && currentAccumulated >= config.charThreshold) {
    triggerSave();
    didTrigger = true;
  }

  // Time-based trigger (debounce)
  if (mode === "smart" || mode === "time") {
    // Clear existing timer if any
    const existingTimer = debounceTimers.get(docPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (!didTrigger) {
      const timer = setTimeout(() => {
        const freshText = doc.getText();
        void saveDiff(workspaceRoot, docPath, problem.slug || String(problem.id), freshText);
      }, config.debounceMs);

      debounceTimers.set(docPath, timer);
    } else {
      debounceTimers.delete(docPath);
    }
  }
}

/**
 * Generates and saves unified diff patch to .leetplus/diffs/<problem_id>/
 */
export async function saveDiff(
  workspaceRoot: string,
  docPath: string,
  slug: string,
  currentText: string
): Promise<void> {
  // Clear any active timers for this document since we are saving now
  const activeTimer = debounceTimers.get(docPath);
  if (activeTimer) {
    clearTimeout(activeTimer);
    debounceTimers.delete(docPath);
  }

  const baselineText = baselineCache.get(docPath);
  if (baselineText === undefined || currentText === baselineText) {
    return;
  }

  // Create temporary directory for diff files
  const tmpDir = path.join(workspaceRoot, ".leetplus", "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const baselineTmpPath = path.join(tmpDir, `baseline_${slug}.tmp`);
  const currentTmpPath = path.join(tmpDir, `current_${slug}.tmp`);

  try {
    fs.writeFileSync(baselineTmpPath, baselineText, "utf-8");
    fs.writeFileSync(currentTmpPath, currentText, "utf-8");

    // Execute git diff --no-index
    let diffOutput = "";
    try {
      diffOutput = execSync(
        `git diff --no-index --patch "${baselineTmpPath}" "${currentTmpPath}"`,
        { encoding: "utf-8" }
      );
    } catch (err: any) {
      if (err.stdout !== undefined && err.stdout !== null) {
        diffOutput = err.stdout;
      } else {
        throw err;
      }
    }

    if (diffOutput.trim()) {
      // Make the patch headers neat and file-relative
      const filename = path.basename(docPath);
      let patch = diffOutput;
      patch = patch.replace(new RegExp(escapeRegExp(baselineTmpPath), "g"), `a/${filename}`);
      patch = patch.replace(new RegExp(escapeRegExp(currentTmpPath), "g"), `b/${filename}`);

      // Create target diffs directory
      const diffsDir = path.join(workspaceRoot, ".leetplus", "diffs", slug);
      if (!fs.existsSync(diffsDir)) {
        fs.mkdirSync(diffsDir, { recursive: true });
      }

      // Safe filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const diffPath = path.join(diffsDir, `${timestamp}.patch`);
      fs.writeFileSync(diffPath, patch, "utf-8");
      Logger.log(`Saved diff patch for '${slug}' to ${diffPath}`);

      // Update state lastActivityDate to track active typing sessions
      try {
        const state = await readState(workspaceRoot);
        if (state) {
          state.lastActivityDate = new Date().toISOString();
          await writeState(workspaceRoot, state);
        }
      } catch {
        // Ignore state write errors
      }
    }

    // Update baseline in memory
    baselineCache.set(docPath, currentText);
    accumulatedChanges.set(docPath, 0);
  } catch (error) {
    // Fail silently or log error
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(baselineTmpPath)) fs.unlinkSync(baselineTmpPath);
      if (fs.existsSync(currentTmpPath)) fs.unlinkSync(currentTmpPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
