import * as fs from "fs";
import * as path from "path";
import { initState } from "./StateManager";
import * as Logger from "./Logger";

const SUBDIRS = ["snapshots", "diffs", "guides", "designs", "behavioral", "plans", "whiteboard"];

export interface InitResult {
  created: boolean;
  migratedFromLegacy: boolean;
  convertedFileToDir: boolean;
  configContent: string | null;
  subdirsCreated: string[];
  stateRepaired: boolean;
}

export async function initializeWorkspaceFolder(rootPath: string): Promise<InitResult> {
  const leetplusDir = path.join(rootPath, ".leetplus");
  const leetcodeFile = path.join(rootPath, ".leetcode");

  const exists = fs.existsSync(leetplusDir);
  const isFile = exists ? fs.statSync(leetplusDir).isFile() : false;

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
  };
}
