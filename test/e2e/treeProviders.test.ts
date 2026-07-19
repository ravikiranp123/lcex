import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "ravikiranp123.leet-plus";

describe("Tree Provider Wiring", () => {
  it("should have tree views accessible from package.json", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);

    const packageJSON = ext.packageJSON;
    const views = packageJSON.contributes?.views?.explorer ?? [];
    const viewIds = views.map((v: { id: string }) => v.id);
    assert.ok(
      viewIds.includes("leetplus-daily-plan"),
      `Expected "leetplus-daily-plan" view. Found: ${viewIds.join(", ")}`
    );
  });

  it("should have onboarding view in activity bar", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);

    const packageJSON = ext.packageJSON;
    const containers =
      packageJSON.contributes?.viewsContainers?.activitybar ?? [];
    const containerIds = containers.map((c: { id: string }) => c.id);
    assert.ok(
      containerIds.includes("leetplus-container"),
      `Expected "leetplus-container" activity bar container. Found: ${containerIds.join(", ")}`
    );
  });

  it("getChildren returns root categories from populated state", async () => {
    const { DailyPlanProvider } = await import(
      "../../src/modules/DailyPlanProvider"
    );

    const mockContext = {
      subscriptions: [],
      workspaceState: {
        get: (_key: string) => undefined,
        update: (_key: string, _val: unknown) => Promise.resolve(),
      },
    } as unknown as vscode.ExtensionContext;

    const provider = new DailyPlanProvider(mockContext);

    const roots = await provider.getChildren(undefined);

    assert.ok(roots.length === 3, `Expected 3 root categories, got ${roots.length}`);

    const ids = roots.map((r) => r.id);
    assert.deepStrictEqual(ids, ["review", "new", "done"]);

    assert.ok(roots[0].label.includes("Review"), "First root should be Review");
    assert.ok(roots[1].label.includes("New"), "Second root should be New");
    assert.ok(roots[2].label.includes("Done"), "Third root should be Done");
  });

  it("getChildren returns problems under each root category", async () => {
    const { DailyPlanProvider } = await import(
      "../../src/modules/DailyPlanProvider"
    );

    const mockContext = {
      subscriptions: [],
      workspaceState: {
        get: (_key: string) => undefined,
        update: (_key: string, _val: unknown) => Promise.resolve(),
      },
    } as unknown as vscode.ExtensionContext;

    const provider = new DailyPlanProvider(mockContext);
    const roots = await provider.getChildren(undefined);

    for (const root of roots) {
      const children = await provider.getChildren(root);
      assert.ok(
        Array.isArray(children),
        `Children of "${root.id}" should be an array`
      );

      for (const child of children) {
        assert.strictEqual(
          child.type,
          "problem",
          "Child items should have type 'problem'"
        );
        assert.ok(child.problem, "Child should have a problem reference");
        assert.ok(child.problem!.id, "Problem should have an id");
        assert.ok(child.problem!.title, "Problem should have a title");
      }
    }

    const reviewRoot = roots.find((r) => r.id === "review")!;
    const reviewChildren = await provider.getChildren(reviewRoot);
    assert.strictEqual(
      reviewChildren.length,
      2,
      "Review should have 2 completed problems (id 1 and 2)"
    );

    const newRoot = roots.find((r) => r.id === "new")!;
    const newChildren = await provider.getChildren(newRoot);
    assert.strictEqual(
      newChildren.length,
      1,
      "New should have 1 pending problem (id 3)"
    );

    const doneRoot = roots.find((r) => r.id === "done")!;
    const doneChildren = await provider.getChildren(doneRoot);
    assert.strictEqual(doneChildren.length, 0, "Done should be empty (none solved today)");
  });

  it("tree items have correct contextValue", async () => {
    const { DailyPlanProvider, DailyPlanTreeItem } = await import(
      "../../src/modules/DailyPlanProvider"
    );

    const mockContext = {
      subscriptions: [],
      workspaceState: {
        get: (_key: string) => undefined,
        update: (_key: string, _val: unknown) => Promise.resolve(),
      },
    } as unknown as vscode.ExtensionContext;

    const provider = new DailyPlanProvider(mockContext);
    const roots = await provider.getChildren(undefined);

    for (const root of roots) {
      const treeItem = provider.getTreeItem(root);
      assert.strictEqual(
        treeItem.contextValue,
        "root",
        `Root "${root.id}" should have contextValue "root"`
      );
    }

    const reviewRoot = roots.find((r) => r.id === "review")!;
    const reviewChildren = await provider.getChildren(reviewRoot);
    for (const child of reviewChildren) {
      const treeItem = provider.getTreeItem(child);
      assert.strictEqual(
        treeItem.contextValue,
        "problem",
        `Problem "${child.label}" should have contextValue "problem"`
      );
    }
  });
});
