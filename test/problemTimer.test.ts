import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as vscode from "vscode";
import { getTitleSlugForActiveSolutionFile, problemViews } from "../src/modules/ProblemView";

describe("ProblemTimer & getTitleSlugForActiveSolutionFile", () => {
  let originalActiveTextEditor: any;

  beforeEach(() => {
    originalActiveTextEditor = vscode.window.activeTextEditor;
  });

  afterEach(() => {
    vscode.window.activeTextEditor = originalActiveTextEditor;
    problemViews.clear();
  });

  it("identifies active solution file when using id.slug pattern (e.g. 217.contains-duplicate.py)", () => {
    const mockContext = {
      globalState: {
        get: () => undefined,
      },
    } as any;

    const mockState = {
      problem: {
        id: 217,
        titleSlug: "contains-duplicate",
      },
    };

    problemViews.set("contains-duplicate", {
      panel: { active: false, visible: true },
      problem: mockState.problem,
    } as any);

    vscode.window.activeTextEditor = {
      document: {
        uri: { fsPath: "/workspace/217.contains-duplicate.py" },
      },
    } as any;

    const slug = getTitleSlugForActiveSolutionFile(mockContext);
    expect(slug).toBe("contains-duplicate");
  });
});
