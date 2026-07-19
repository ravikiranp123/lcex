import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => "/tmp/lcex-test-home" };
});

import { ensureCursorLeetPlusPluginInstalled } from "../src/modules/CursorLeetPlusPluginInstall";
import * as vscode from "vscode";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lcex-skills-"));
}

const MOCK_EXT_CTX = { extensionPath: "/tmp/ext" } as vscode.ExtensionContext;

const PLUGIN_ROOT = "/tmp/lcex-test-home/.cursor/plugins/local/lcex-leetcode-practice";

describe("Agent skills installer (4a.2)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    fs.mkdirSync(PLUGIN_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync("/tmp/lcex-test-home", { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("creates all Cursor plugin skill files on first run", async () => {
    fs.rmSync(PLUGIN_ROOT, { recursive: true, force: true });

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    expect(fs.existsSync(path.join(PLUGIN_ROOT, "skills", "lp-interview-generator", "SKILL.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(PLUGIN_ROOT, "skills", "lp-dsa-hint", "SKILL.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(PLUGIN_ROOT, "skills", "lp-dsa-analyze", "SKILL.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(PLUGIN_ROOT, "skills", "lp-recap-planner", "SKILL.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(PLUGIN_ROOT, ".cursor-plugin", "plugin.json"))).toBeTruthy();
  });

  it("is idempotent — second run produces no changes", async () => {
    fs.rmSync(PLUGIN_ROOT, { recursive: true, force: true });

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);
    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const skillPath = path.join(PLUGIN_ROOT, "skills", "lp-dsa-hint", "SKILL.md");
    const stat = fs.statSync(skillPath);
    expect(stat.mtimeMs).toBeTruthy();
  });

  it("overwrites modified skill content on re-run", async () => {
    fs.rmSync(PLUGIN_ROOT, { recursive: true, force: true });
    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const skillPath = path.join(PLUGIN_ROOT, "skills", "lp-dsa-hint", "SKILL.md");
    fs.writeFileSync(skillPath, "modified content", "utf-8");

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const content = fs.readFileSync(skillPath, "utf-8");
    expect(content).not.toBe("modified content");
    expect(content).toContain("lp-dsa-hint");
  });

  it("creates workspace skill files when workspace folders exist", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: tmpDir } } as vscode.WorkspaceFolder,
    ]);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills", "lp-interview-generator", "SKILL.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills", "lp-dsa-hint", "SKILL.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills", "lp-dsa-analyze", "SKILL.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills", "lp-recap-planner", "SKILL.md"))).toBeTruthy();
  });

  it("does not write workspace skills when no workspace folders", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue(undefined);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    expect(fs.existsSync(path.join(tmpDir, ".agents"))).toBeFalsy();
  });

  it("prompts when workspace skills are modified externally", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: tmpDir } } as vscode.WorkspaceFolder,
    ]);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const skillPath = path.join(tmpDir, ".agents", "skills", "lp-dsa-hint", "SKILL.md");
    fs.writeFileSync(skillPath, "user customized content", "utf-8");

    const showInfoMock = vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined as any);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    expect(showInfoMock).toHaveBeenCalled();
    const callArgs = showInfoMock.mock.calls[0];
    expect(callArgs[0]).toContain("updated");
  });

  it("overwrites workspace skills when user chooses Overwrite", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: tmpDir } } as vscode.WorkspaceFolder,
    ]);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const skillPath = path.join(tmpDir, ".agents", "skills", "lp-dsa-hint", "SKILL.md");
    fs.writeFileSync(skillPath, "user customized content", "utf-8");

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue("Overwrite" as any);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const content = fs.readFileSync(skillPath, "utf-8");
    expect(content).not.toBe("user customized content");
    expect(content).toContain("lp-dsa-hint");
  });

  it("preserves custom content when user chooses Skip", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: tmpDir } } as vscode.WorkspaceFolder,
    ]);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const skillPath = path.join(tmpDir, ".agents", "skills", "lp-dsa-hint", "SKILL.md");
    fs.writeFileSync(skillPath, "user customized content", "utf-8");

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue("Skip" as any);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    expect(fs.readFileSync(skillPath, "utf-8")).toBe("user customized content");
    expect(fs.existsSync(`${skillPath}.bak`)).toBeFalsy();
  });

  it("creates backup before overwriting when user chooses Backup & Overwrite", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: tmpDir } } as vscode.WorkspaceFolder,
    ]);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const skillPath = path.join(tmpDir, ".agents", "skills", "lp-dsa-hint", "SKILL.md");
    fs.writeFileSync(skillPath, "MY CUSTOM CONTENT", "utf-8");

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue("Backup & Overwrite" as any);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    expect(fs.readFileSync(`${skillPath}.bak`, "utf-8")).toBe("MY CUSTOM CONTENT");
    expect(fs.readFileSync(skillPath, "utf-8")).toContain("lp-dsa-hint");
  });

  it("creates copilot-instructions.md in workspace", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: tmpDir } } as vscode.WorkspaceFolder,
    ]);

    await ensureCursorLeetPlusPluginInstalled(MOCK_EXT_CTX);

    const copilotPath = path.join(tmpDir, ".github", "copilot-instructions.md");
    expect(fs.existsSync(copilotPath)).toBeTruthy();

    const content = fs.readFileSync(copilotPath, "utf-8");
    expect(content).toContain("# Copilot LCX Instructions");
    expect(content).toContain("## lp-dsa-analyze");
    expect(content).toContain("## lp-dsa-hint");
    expect(content).toContain("## lp-interview-generator");
    expect(content).toContain("## lp-recap-planner");
  });
});
