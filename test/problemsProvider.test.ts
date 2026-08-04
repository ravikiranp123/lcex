import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import * as vscode from "vscode";
import { ProblemsTreeProvider, CategoryTreeItem } from "../src/modules/ProblemsProvider";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "lcex-probprov-"));
}

describe("ProblemsTreeProvider", () => {
  let tmpDir: string;
  let originalFolders: any;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalFolders = vscode.workspace.workspaceFolders;
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = originalFolders;
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load study plan groups from local data file when present", async () => {
    const dataDir = path.join(tmpDir, ".leetplus", "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "neetcode-150.json"),
      JSON.stringify({
        "Arrays & Hashing": ["two-sum", "contains-duplicate"],
        "Two Pointers": ["valid-palindrome"]
      }),
      "utf-8"
    );

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const mockMemento = {
      get: vi.fn().mockReturnValue({}),
      update: vi.fn(),
    } as any;

    const provider = new ProblemsTreeProvider("neetcode-150", mockMemento, tmpDir);

    const children = await provider.getChildren();

    expect(children.length).toBe(2);
    expect(children[0]).toBeInstanceOf(CategoryTreeItem);
    const cat1 = children[0] as CategoryTreeItem;
    expect(cat1.category).toBe("Arrays & Hashing");
    expect(cat1.problems.length).toBe(2);
    expect(cat1.problems[0].titleSlug).toBe("two-sum");
    expect(cat1.problems[0].title).toBe("Two Sum");

    const cat2 = children[1] as CategoryTreeItem;
    expect(cat2.category).toBe("Two Pointers");
    expect(cat2.problems[0].titleSlug).toBe("valid-palindrome");
  });

  it("should handle custom configured plan path in config.json", async () => {
    const customPath = "custom/my-study-plan.json";
    const fullPath = path.join(tmpDir, customPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(
      fullPath,
      JSON.stringify({
        "Trees": ["maximum-depth-of-binary-tree"]
      }),
      "utf-8"
    );

    const configDir = path.join(tmpDir, ".leetplus");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "config.json"),
      JSON.stringify({
        studyPlans: [
          { slug: "custom-plan", name: "My Custom Plan", path: customPath }
        ]
      }),
      "utf-8"
    );

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const mockMemento = {
      get: vi.fn().mockReturnValue({}),
      update: vi.fn(),
    } as any;

    const provider = new ProblemsTreeProvider("custom-plan", mockMemento, tmpDir);

    const children = await provider.getChildren();

    expect(children.length).toBe(1);
    const cat = children[0] as CategoryTreeItem;
    expect(cat.category).toBe("Trees");
    expect(cat.problems[0].titleSlug).toBe("maximum-depth-of-binary-tree");
  });

  it("setPlanSlug should reset groups and trigger refresh", async () => {
    const dataDir = path.join(tmpDir, ".leetplus", "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "plan-a.json"),
      JSON.stringify({ "Category A": ["problem-a"] }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(dataDir, "plan-b.json"),
      JSON.stringify({ "Category B": ["problem-b"] }),
      "utf-8"
    );

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: tmpDir } as any, name: "TestWorkspace", index: 0 }
    ];

    const mockMemento = { get: vi.fn().mockReturnValue({}), update: vi.fn() } as any;
    const provider = new ProblemsTreeProvider("plan-a", mockMemento, tmpDir);

    let children = await provider.getChildren();
    expect((children[0] as CategoryTreeItem).category).toBe("Category A");

    provider.setPlanSlug("plan-b");

    children = await provider.getChildren();
    expect((children[0] as CategoryTreeItem).category).toBe("Category B");
  });
});
