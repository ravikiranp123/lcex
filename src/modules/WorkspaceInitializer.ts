import * as fs from "fs";
import * as path from "path";
import { initState } from "./StateManager";
import * as Logger from "./Logger";

const SUBDIRS = ["snapshots", "diffs", "guides", "designs", "behavioral", "plans", "whiteboard", "archive"];

export const DEFAULT_GITIGNORE_PATTERNS = [
  "# Python",
  "__pycache__/",
  "*.pyc",
  "*.pyo",
  "*.pyd",
  ".pytest_cache/",
  ".venv/",
  "venv/",
  "",
  "# Compiled files",
  "*.class",
  "*.out",
  "*.exe",
  "*.o",
  "",
  "# OS & IDE files",
  ".DS_Store",
  "Thumbs.db",
  "",
  "# LeetPlus temporary files",
  ".leetplus/*.tmp",
  ".leetplus/**/*.tmp",
];

export interface InitResult {
  created: boolean;
  migratedFromLegacy: boolean;
  convertedFileToDir: boolean;
  configContent: string | null;
  subdirsCreated: string[];
  stateRepaired: boolean;
  gitignoreCreated: boolean;
}

/**
 * Ensures a .gitignore file exists in rootPath and contains standard ignore rules
 * for Python bytecode (*.pyc, __pycache__/), compiled binaries, OS files, and temp files.
 * If .gitignore already exists, appends any missing patterns.
 *
 * @returns true if .gitignore was created or modified, false if already up-to-date.
 */
export function ensureGitignore(rootPath: string): boolean {
  const gitignorePath = path.join(rootPath, ".gitignore");

  if (!fs.existsSync(gitignorePath)) {
    try {
      fs.writeFileSync(gitignorePath, DEFAULT_GITIGNORE_PATTERNS.join("\n") + "\n", "utf-8");
      Logger.log(`Created .gitignore in ${rootPath}`);
      return true;
    } catch (e) {
      Logger.log(`Failed to create .gitignore in ${rootPath}: ${e}`);
      return false;
    }
  }

  try {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    const requiredPatterns = ["*.pyc", "__pycache__/"];
    const missing = requiredPatterns.filter((pat) => !lines.includes(pat));

    if (missing.length > 0) {
      let updated = content;
      if (!updated.endsWith("\n")) {
        updated += "\n";
      }
      updated += "\n# Python (added by LeetPlus)\n" + missing.join("\n") + "\n";
      fs.writeFileSync(gitignorePath, updated, "utf-8");
      Logger.log(`Updated .gitignore in ${rootPath} with missing patterns: ${missing.join(", ")}`);
      return true;
    }
  } catch (e) {
    Logger.log(`Failed to update .gitignore in ${rootPath}: ${e}`);
  }

  return false;
}

export async function initializeWorkspaceFolder(rootPath: string): Promise<InitResult> {
  const leetplusDir = path.join(rootPath, ".leetplus");
  const leetcodeFile = path.join(rootPath, ".leetcode");

  const exists = fs.existsSync(leetplusDir);
  const isFile = exists ? fs.statSync(leetplusDir).isFile() : false;

  const gitignoreCreated = ensureGitignore(rootPath);

  if (isFile) {
    let configContent = "{}";
    try {
      configContent = fs.readFileSync(leetplusDir, "utf-8");
    } catch { /* ignore */ }

    fs.unlinkSync(leetplusDir);
    fs.mkdirSync(leetplusDir, { recursive: true });

    for (const d of SUBDIRS) {
      fs.mkdirSync(path.join(leetplusDir, d), { recursive: true });
    }

    fs.writeFileSync(path.join(leetplusDir, "config.json"), configContent, "utf-8");
    Logger.log(`Converted .leetplus file to directory in ${rootPath}`);

    return {
      created: true,
      migratedFromLegacy: false,
      convertedFileToDir: true,
      configContent,
      subdirsCreated: [...SUBDIRS],
      stateRepaired: false,
      gitignoreCreated,
    };
  }

  if (!exists) {
    if (fs.existsSync(leetcodeFile)) {
      fs.mkdirSync(leetplusDir, { recursive: true });
      for (const d of SUBDIRS) {
        fs.mkdirSync(path.join(leetplusDir, d), { recursive: true });
      }

      let configContent = "{}";
      try {
        configContent = fs.readFileSync(leetcodeFile, "utf-8");
      } catch { /* ignore */ }

      fs.writeFileSync(path.join(leetplusDir, "config.json"), configContent, "utf-8");
      fs.unlinkSync(leetcodeFile);

      Logger.log(`Successfully migrated legacy config in ${rootPath} to LeetPlus`);

      await initState(rootPath, "My Practice Plan", []);

      return {
        created: true,
        migratedFromLegacy: true,
        convertedFileToDir: false,
        configContent,
        subdirsCreated: [...SUBDIRS],
        stateRepaired: false,
        gitignoreCreated,
      };
    }

    fs.mkdirSync(leetplusDir, { recursive: true });
    for (const d of SUBDIRS) {
      fs.mkdirSync(path.join(leetplusDir, d), { recursive: true });
    }

    fs.writeFileSync(
      path.join(leetplusDir, "config.json"),
      JSON.stringify({ language: "typescript" }, null, 2) + "\n",
      "utf-8"
    );

    await initState(rootPath, "My Practice Plan", []);

    return {
      created: true,
      migratedFromLegacy: false,
      convertedFileToDir: false,
      configContent: JSON.stringify({ language: "typescript" }, null, 2) + "\n",
      subdirsCreated: [...SUBDIRS],
      stateRepaired: false,
      gitignoreCreated,
    };
  }

  const subdirsCreated: string[] = [];
  for (const d of SUBDIRS) {
    const subPath = path.join(leetplusDir, d);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
      subdirsCreated.push(d);
    }
  }

  if (subdirsCreated.length > 0) {
    Logger.log(`Restored missing subdirectories: ${subdirsCreated.join(", ")}`);
  }

  const stateJson = path.join(leetplusDir, "state.json");
  let stateRepaired = false;
  if (!fs.existsSync(stateJson)) {
    await initState(rootPath, "My Practice Plan", []);
    stateRepaired = true;
    Logger.log(`Repaired/recreated missing state.json in ${rootPath}`);
  }

  return {
    created: false,
    migratedFromLegacy: false,
    convertedFileToDir: false,
    configContent: null,
    subdirsCreated,
    stateRepaired,
    gitignoreCreated,
  };
}
