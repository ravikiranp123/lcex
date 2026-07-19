import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "ravikiranp123.leet-plus";

describe("Extension Activation", () => {
  it("should activate without error on a LeetPlus workspace", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `Extension ${EXTENSION_ID} not found`);

    if (!ext.isActive) {
      await ext.activate();
    }

    assert.strictEqual(ext.isActive, true, "Extension should be active");
  });

  it("should have all commands from package.json registered", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const packageJSON = ext.packageJSON;
    const expectedCommands: string[] = packageJSON.contributes.commands.map(
      (c: { command: string }) => c.command
    );

    const registeredCommands = await vscode.commands.getCommands(true);

    const missing = expectedCommands.filter((cmd) => !registeredCommands.includes(cmd));
    assert.strictEqual(
      missing.length,
      0,
      `Commands not registered: ${missing.join(", ")}`
    );
  });
});
