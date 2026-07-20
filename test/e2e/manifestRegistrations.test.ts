import * as assert from "node:assert";
import * as path from "node:path";

const PKG_PATH = path.resolve(__dirname, "../../../package.json");

describe("Tree views registered", () => {
  it("should have tree view registrations in package.json", () => {
    const pkg = require(PKG_PATH);
    const views = pkg.contributes?.views || {};
    const allViews: any[] = [];
    for (const container of Object.values(views)) {
      if (Array.isArray(container)) {
        allViews.push(...container);
      }
    }
    const viewIds = allViews.map((v: any) => v.id);
    assert.ok(
      viewIds.includes("leetplus-daily-plan"),
      `Daily plan view not found. Got: ${viewIds.join(", ")}`
    );
  });
});

describe("Custom editors registered", () => {
  it("should have custom editor contributions in package.json", () => {
    const pkg = require(PKG_PATH);
    const editors = pkg.contributes?.customEditors || [];
    const patterns = editors.map((e: any) => e.selector?.[0]?.filenamePattern);
    assert.ok(
      patterns.includes("**/.leetplus/config.json"),
      `Config editor not found. Got: ${patterns.join(", ")}`
    );
  });
});
