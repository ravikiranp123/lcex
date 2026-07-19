# AGENTS.md — Task Execution Workflow

## Workflow

For every task in the todo list, follow this sequence:

1. **Complete the todo** — implement the code changes, write tests, or make the required modifications.
2. **Run tests and update code** — run the relevant test suite (`npm test` or targetted vitest command). If tests fail, fix the code or tests until they pass.
3. **Get confirmation from user** — present a summary of what was done and what tests passed. Wait for the user to verify and approve before proceeding.
4. **Commit** — only after explicit user approval, commit the changes with a concise message.

## Rules

- Never skip the user confirmation step.
- Never commit without explicit permission.
- If a todo has subtasks, complete ALL subtasks before moving to step 2.
- Run the full test suite after completing a section (e.g., after all 4a.0.x subtasks are done).
- Reference `plans/task.md` for detailed task specifications.
- Reference `plans/test_gap_analysis.md` for test coverage context.
- Reference `plans/implementation_plan.md` for architecture and design decisions.

## Critical: When Extracting Logic into Testable Modules

When refactoring source code to make it testable (extracting functions into new modules):

1. **NEVER truncate or placeholder content.** All strings, constants, and logic must be copied EXACTLY as-is from the original source.
2. **Verify content** — after extraction, diff the new module against the original to ensure nothing was lost or shortened.
3. **Tests must call actual source code** — never create `simulateXxx` functions that duplicate source logic. Extract the real logic into testable functions and import them in tests.
4. **Prefer adding `export` to existing functions over creating new files.** Only create a new module when the source file cannot be imported in tests (e.g., `extension.ts` with side effects).
5. **Pre-commit checklist for extraction:**
   - [ ] New module exports all extracted functions/constants
   - [ ] Original file imports and uses the new module
   - [ ] `git diff original-file` shows only imports + calls, no logic changes
   - [ ] `git diff new-module` shows full content copied verbatim
   - [ ] Tests import from new module, not original file

## Test Hygiene Standards

These rules apply to every test file written in this project. Violations are bugs, not style issues.

### 1. Per-test isolation — always use `mkdtempSync`
Never use a shared `const TEST_DIR` with `beforeAll/afterAll`. Every test that touches the filesystem must create its own directory in `beforeEach` and delete it in `afterEach`:
```ts
let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lcex-")); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });
```

### 2. Mock VS Code APIs with `vi.spyOn`, never by direct assignment
Direct mutation (`vscode.window.showInformationMessage = ...`) leaks across tests. Always use `vi.spyOn` so mocks are automatically reverted by `vi.restoreAllMocks()` in `afterEach`:
```ts
afterEach(() => { vi.restoreAllMocks(); });

// Inside each test:
vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue("Overwrite" as any);
```

### 3. Never couple tests to mock internals
Do not access `vscode._statusBarItems`, `vscode._clearChangeListeners`, or any other `_`-prefixed mock implementation detail in assertions. If you need to observe a VS Code API call, spy on it:
```ts
const spy = vi.spyOn(vscode.window, "createStatusBarItem");
// ... run code ...
expect(spy).toHaveBeenCalled();
```
Exception: calling `vscode._fireDidChangeTextDocument` to *drive* events in `DiffLogger` tests is acceptable because there is no other way to simulate file-change events without VS Code's runtime.

### 4. No vacuous conditional assertions
Every `expect` must be reachable on every run. An assertion inside an `if` block that can evaluate to `false` is not a test — it is a no-op that will always pass. Restructure inputs so the pre-condition is guaranteed, then assert unconditionally.
```ts
// ❌ Wrong — silently skips the assertion
if (resultNoHints.rating <= 1) {
  expect(resultTwoHints.rating).toBeGreaterThan(resultNoHints.rating);
}

// ✅ Correct — use inputs that guarantee the pre-condition, then assert
expect(resultTwoHints.rating).toBeGreaterThan(resultNoHints.rating);
```

### 5. Integration tests must be guarded against offline runs
Any test that makes a real network call must have a skip guard so it does not break CI:
```ts
it.skipIf(!process.env.LEETCODE_SESSION)("fetches live problem", async () => { ... });
```
Or exclude integration test files from the default vitest run in `vitest.config.ts` and provide a separate `npm run test:integration` script.
