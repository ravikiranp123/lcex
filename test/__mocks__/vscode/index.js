"use strict";

const _changeListeners = [];

const workspace = {
  workspaceFolders: undefined,
  textDocuments: [],
  getConfiguration: () => ({ get: () => undefined }),
  onDidChangeTextDocument: (listener) => {
    _changeListeners.push(listener);
    return { dispose: () => {} };
  },
  onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  openTextDocument: () => Promise.resolve({ getText: () => "", uri: { fsPath: "" } }),
  registerTextDocumentContentProvider: () => ({ dispose: () => {} }),
  applyEdit: () => Promise.resolve(true),
  getWorkspaceFolder: () => undefined,
  fs: {
    readFile: () => Promise.resolve(new Uint8Array()),
    writeFile: () => Promise.resolve(),
    createDirectory: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    stat: () => Promise.resolve({ type: 0 }),
  },
};

const _fireDidChangeTextDocument = async (event) => {
  for (const listener of _changeListeners) {
    listener(event);
  }
};

const _clearChangeListeners = () => {
  _changeListeners.length = 0;
};

const window = {
  createStatusBarItem: () => ({
    text: "",
    tooltip: "",
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  showInformationMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  showErrorMessage: () => Promise.resolve(undefined),
  showQuickPick: () => Promise.resolve(undefined),
  withProgress: () => Promise.resolve(),
  activeTextEditor: undefined,
  activeTerminal: undefined,
  activeColorTheme: { kind: 1 },
  visibleTextEditors: [],
  state: { focused: true },
  createWebviewPanel: () => ({
    webview: { html: "", postMessage: () => Promise.resolve() },
    reveal: () => {},
    dispose: () => {},
    onDidDispose: () => ({ dispose: () => {} }),
  }),
  createTerminal: () => ({
    sendText: () => {},
    show: () => {},
    dispose: () => {},
  }),
  createTextEditorDecorationType: () => ({
    key: "",
    dispose: () => {},
  }),
  showTextDocument: () => Promise.resolve(),
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  onDidChangeWindowState: () => ({ dispose: () => {} }),
  showInputBox: () => Promise.resolve(undefined),
};

const commands = {
  executeCommand: () => Promise.resolve(),
  getCommands: () => Promise.resolve([]),
  registerCommand: () => ({ dispose: () => {} }),
};

const extensions = {
  getExtension: () => undefined,
};

const Uri = {
  file: (p) => ({ fsPath: p, scheme: "file", toString: () => `file://${p}` }),
  from: ({ scheme, path }) => ({
    fsPath: path,
    scheme: scheme || "file",
    toString: () => `${scheme}://${path}`,
  }),
  joinPath: (uri, ...segs) => {
    const joined = [uri.fsPath, ...segs].join("/").replace(/\/+/g, "/");
    return { fsPath: joined, scheme: uri.scheme, toString: () => `${uri.scheme}://${joined}` };
  },
};

class TreeItem {
  constructor(label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

class ThemeIcon {
  constructor(id, color) {
    this.id = id;
    this.color = color;
  }
}

class ThemeColor {
  constructor(id) {
    this.id = id;
  }
}

class EventEmitter {
  constructor() {
    this._listeners = [];
  }
  get event() {
    return (listener) => {
      this._listeners.push(listener);
      return { dispose: () => {} };
    };
  }
  fire(data) {
    for (const l of this._listeners) l(data);
  }
  dispose() {
    this._listeners = [];
  }
}

class Disposable {
  constructor(fn) {
    this._fn = fn;
  }
  dispose() {
    if (this._fn) this._fn();
  }
}

class CancellationTokenSource {
  constructor() {
    this.token = { isCancellationRequested: false };
  }
  cancel() {
    this.token.isCancellationRequested = true;
  }
  dispose() {}
}

const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
const ProgressLocation = { Notification: 15 };
const ViewColumn = { One: 1, Two: 2, Three: 3, Beside: -2 };
const StatusBarAlignment = { Left: 1, Right: 2 };
const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 };
const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
const DecorationRangeBehavior = { OpenOpen: 0, ClosedClosed: 1, OpenClosed: 2, ClosedOpen: 3 };

module.exports = {
  workspace,
  window,
  commands,
  extensions,
  Uri,
  TreeItem,
  ThemeIcon,
  ThemeColor,
  EventEmitter,
  Disposable,
  CancellationTokenSource,
  TreeItemCollapsibleState,
  ProgressLocation,
  ViewColumn,
  StatusBarAlignment,
  ColorThemeKind,
  ConfigurationTarget,
  DecorationRangeBehavior,
  _fireDidChangeTextDocument,
  _clearChangeListeners,
};
