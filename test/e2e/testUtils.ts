import * as sinon from "sinon";
import * as vscode from "vscode";

const _stubs: sinon.SinonStub[] = [];

export function stubQuickPick(
  returnValue: vscode.QuickPickItem | Thenable<vscode.QuickPickItem | undefined> | undefined
): sinon.SinonStub {
  const stub = sinon.stub(vscode.window, "showQuickPick").resolves(returnValue as any);
  _stubs.push(stub);
  return stub;
}

export function stubInputBox(
  returnValue: string | Thenable<string | undefined> | undefined
): sinon.SinonStub {
  const stub = sinon.stub(vscode.window, "showInputBox").resolves(returnValue as any);
  _stubs.push(stub);
  return stub;
}

export function stubInformationMessage(
  returnValue: string | Thenable<string | undefined> | undefined
): sinon.SinonStub {
  const stub = sinon.stub(vscode.window, "showInformationMessage").resolves(returnValue as any);
  _stubs.push(stub);
  return stub;
}

export function stubWarningMessage(
  returnValue: string | Thenable<string | undefined> | undefined
): sinon.SinonStub {
  const stub = sinon.stub(vscode.window, "showWarningMessage").resolves(returnValue as any);
  _stubs.push(stub);
  return stub;
}

export function stubErrorMessage(
  returnValue: string | Thenable<string | undefined> | undefined
): sinon.SinonStub {
  const stub = sinon.stub(vscode.window, "showErrorMessage").resolves(returnValue as any);
  _stubs.push(stub);
  return stub;
}

export function restoreAllStubs(): void {
  for (const stub of _stubs) {
    stub.restore();
  }
  _stubs.length = 0;
}

export function getFixtureRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("No workspace folders available");
  }
  return folders[0].uri.fsPath;
}
