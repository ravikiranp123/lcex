# LeetPlus — Implementation Task List

> All tasks reference the [implementation_plan.md](file:///Users/ravi/.gemini/antigravity/brain/60913b16-eb0b-4608-a67c-f5a428cdf68c/implementation_plan.md) for detailed specs.

---

## Phase 0: Project Rename & Identity 🔴
> Depends on: Nothing

- [x] **0.1 — Rename `package.json` identity**
  - Change `name` to `leet-plus`, `displayName` to `LeetPlus`
  - Update `publisher` field to your marketplace ID
  - Update `description` to lead with the differentiator: "SRS-based review scheduling + trajectory-aware AI"
  - Update `repository` URL to the new repo

- [x] **0.2 — Rename all command prefixes**
  - Find every `"LeetCode Practice:"` command title in `package.json` `contributes.commands` and change to `"LeetPlus:"`
  - Find every command ID starting with `leetcode-practice.` and rename to `leetplus.`
  - Update all references to old command IDs across all `.ts` files (use project-wide find/replace)

- [x] **0.3 — Rename config directory references**
  - Find every reference to `.leetcode` directory path in source and replace with `.leetplus`
  - This includes `LeetcodeConfig.ts`, any `path.join` calls, and settings references
  - Update `files.associations` in settings to use `.leetplus` paths

- [x] **0.4 — Rename skill files**
  - Rename `.agents/skills/lcex-dsa-analyze/` → `.agents/skills/lp-dsa-analyze/`
  - Rename `.agents/skills/lcex-dsa-hint/` → `.agents/skills/lp-dsa-hint/`
  - Rename `.agents/skills/lcex-interview-generator/` → `.agents/skills/lp-interview-generator/`
  - Update `SKILL.md` files inside each — change all internal references from `lcex` to `lp`
  - Update the `name` field in each SKILL.md frontmatter

- [x] **0.5 — Update README.md**
  - Clear attribution: "Hard-forked from [NikkyAmresh/lcex](https://github.com/NikkyAmresh/lcex). Original MIT LICENSE retained."
  - Update all screenshots, feature descriptions, and installation instructions to reference LeetPlus
  - Add brief feature overview covering SRS, AI auto-rating, daily plans

- [x] **0.6 — Create `.leetplus/` directory scaffold**
  - On extension activation, if `.leetplus/` doesn't exist and old `.leetcode` does, offer migration
  - Ensure all new file writes go to `.leetplus/` subdirectories: `snapshots/`, `diffs/`, `guides/`, `designs/`, `behavioral/`, `plans/`, `whiteboard/`

- [x] **0.7 — Update `LeetcodeConfig.ts` → `LeetPlusConfig.ts`**
  - Rename the file and class
  - Update all imports across the project
  - Change the config file path to `.leetplus/config.json`
  - Keep backward compatibility: if `.leetcode` exists but `.leetplus` doesn't, read from `.leetcode` and suggest migration

---

## Phase 1: Core Engine — SRS & State 🔴
> Depends on: Phase 0

- [x] **1.1 — Create `StateManager.ts`**
  - Define `LPState`, `LPProblem`, `LPSnapshot` TypeScript interfaces exactly as specified in the plan (see Phase 1 schema)
  - All timestamps must be ISO 8601 UTC (Amendment T)
  - Implement `readState()`: read from `<workspace>/.leetplus/state.json`, parse JSON, validate against interfaces
  - Implement `writeState()`: serialize state to JSON with 2-space indent, write atomically (write to `.tmp` then rename)
  - Implement `initState(planName, problems)`: create a new state from a study plan JSON file
  - Handle file-not-found gracefully: trigger onboarding (Phase 19) when state doesn't exist

- [x] **1.2 — Create `SRSEngine.ts`**
  - Implement `calculateNextInterval(rating, currentLevel)` matching prep-station's logic exactly:
    - Rating 0 (Mastered): interval=365, level=99
    - Rating 1 (Easy): interval=20, level+1
    - Rating 2 (Good): interval=REPETITION_INTERVALS[min(level, 4)], level+1
    - Rating 3 (Hard): interval=2, level-1 (min 0)
    - Rating 4 (Again): interval=1, level=0
    - REPETITION_INTERVALS = [1, 7, 16, 35, 90]
  - Implement `updateStreaks(state)`: count consecutive days from completion dates. Update `currentStreak` and `bestStreak`
  - Implement `updatePatternMastery(patternName, outcome, currentScore)`:
    - Success: gain = 0.1 * (1.0 - current)
    - Struggle: gain = 0.05 * (1.0 - current)
    - Failure: penalty = -0.1 (flat)
    - Clamp result to [0.0, 1.0]
  - Implement `getDueProblems(state, date)`: return all problems where `nextRepetitionDate <= date`
  - Write unit tests verifying interval calculations match prep-station's Python output

- [x] **1.3 — Create `SnapshotManager.ts`**
  - Implement `captureSnapshot(problemId, solutionFilePath, metadata)`:
    - Copy the solution file to `.leetplus/snapshots/<problem_id>/<ISO-date>.<ext>`
    - Create `LPSnapshot` record with: date, rating, timeSpentSeconds, hintsUsed, patternsDetected, aiRating, aiJustification
    - Append the snapshot to the problem's `completionHistory` array in state.json
  - Implement `getSnapshots(problemId)`: return all snapshots sorted chronologically
  - Implement `getLatestSnapshot(problemId)`: return the most recent snapshot or null
  - Integrate with `ProblemTimer.ts` to read elapsed seconds
  - Integrate with `PatternDetector.ts` to run detection on the solution file

- [x] **1.4 — Add status bar item (Amendment Q)**
  - Create a `vscode.window.createStatusBarItem` with alignment left, priority 100
  - Display: `🔥 {streak} | 📋 {dueCount} due`
  - Update on activation, on state change, and on daily plan generation
  - On click: execute `leetplus.showDailyPlan` command (Phase 3) or show a notification if not yet implemented
  - Register the status bar item in `extension.ts` `activate()` function

---

## Phase 2: Diff Logger 🔴
> Depends on: Phase 0

- [x] **2.1 — Create `DiffLogger.ts`**
  - Register a `vscode.workspace.onDidChangeTextDocument` listener (not FileSystemWatcher — we need in-memory content)
  - On first open of a tracked file, cache its content as the "baseline"
  - Track file extensions from config: default `[".py", ".ts", ".js", ".cpp", ".java", ".go"]`
  - Implement three trigger modes (configurable via `.leetplus/config.json` `diffLogger.triggerMode`):
    - **time**: debounce timer (default 10000ms). After N ms of no changes, save diff.
    - **change**: character change counter. After N chars changed since last diff, save diff. Default 100.
    - **smart** (default): whichever fires first — time OR change threshold.
  - On trigger: generate a unified diff between cached baseline and current content
  - Save diff to `.leetplus/diffs/<problem_id>/<ISO-timestamp>.patch`
  - Update baseline to current content after saving
  - The problem_id is determined by matching the active file path against LeetCode solution patterns

- [x] **2.2 — Make DiffLogger configurable and opt-in**
  - Read `diffLogger.enabled` from config (default: `true`)
  - Read `diffLogger.triggerMode`, `diffLogger.debounceMs`, `diffLogger.charThreshold`, `diffLogger.trackedExtensions`
  - If `enabled: false`, don't register the listener at all
  - Provide a command `LeetPlus: Toggle Diff Logger` to enable/disable at runtime

- [x] **2.3 — Diff retention strategy**
  - Read `diffRetention` from config: `"session"` (default), `"all"`, or `"none"`
  - `session`: on rating confirmation, move current session diffs to the snapshot archive. Delete old session diffs.
  - `all`: keep all diffs forever.
  - `none`: diffs are generated for real-time AI analysis but discarded after session.

---

## Phase 3: Daily Plan Sidebar 🔴
> Depends on: Phase 1

- [x] **3.1 — Create `DailyPlanProvider.ts` (TreeDataProvider)**
  - Implement `vscode.TreeDataProvider<DailyPlanItem>` for the sidebar panel
  - Register the tree view in `package.json` under `contributes.views` with a `leetplus-daily-plan` viewId
  - Tree structure: three root nodes (Review, New, Done) with problem children under each
  - Each problem item shows: emoji status icon, problem number, title, difficulty tag, SRS info (e.g., "Hard — due today")
  - Clicking a problem executes the existing `leetplus.showProblem` command

- [x] **3.2 — Implement daily plan generation logic**
  - Port prep-station's `generate_daily_plan()` algorithm
  - Build 3 queues from state: urgent (last rating=4), normal (SRS-due today), pending (new from plan)
  - Implement 4 scheduling modes:
    - **Interleaved** (default): round-robin 1 urgent → 1 new → 1 normal → 1 new → remaining
    - **Review-first**: urgent → normal → pending
    - **Push**: urgent → pending → normal
    - **Recap**: only reviews, fallback to random completed if none due
  - Implement weak pattern auto-queue: check `patternMastery` scores, if lowest patterns have available unmastered problems, prioritize those in "New" slots
  - Default: 5 problems per day (configurable via `srs.problemsPerDay`)

- [x] **3.3 — Auto-generate plan on activation / Bootstrap from study plan**
  - `DailyPlanProvider` auto-initializes `state.json` (via `initState`) if it doesn't exist
  - If `state.problems` is empty, calls `bootstrapStateFromStudyPlan` to seed from the active study plan via LeetCode API
  - Shows info toast with the number of problems seeded
  - `extension.ts` passes `fetchStudyPlanProblems` callback to `DailyPlanProvider` constructor

- [x] **3.3b — Study Plan Switching with state migration**
  - New `StudyPlanSwitcher.ts` module handles the full switch lifecycle
  - **Schema**: Added `planSlug?`, `archivedProblems?` to `LPState`; added `switchedOut?` to `LPProblem`
  - **Diff computation**: compares state slugs vs new plan slugs → intersection / oldOnly / newOnly
  - **Step 1**: Summary modal (kept / old-only / new-only counts) + Switch/Cancel
  - **Step 2** (if old problems exist): QuickPick with 4 options:
    - Keep active / Archive / Skip / Remove
  - **Auto-restore**: On switch, problems previously archived/skipped via a plan switch (`switchedOut=true`) whose slugs appear in the new plan are automatically restored to `pending`
  - Deletes today's plan file to force regeneration; calls `dailyPlanProvider.refresh()`
  - `leetplus.switchStudyPlan` command now routes through `StudyPlanSwitcher`

- [x] **3.4 — Add sidebar mode switcher (Amendment O)**
  - Add a context menu or dropdown in the TreeView header to switch modes: Interleaved / Review-First / Push / Recap
  - Selecting a mode regenerates the plan immediately with the new mode
  - Persist the selected mode in `config.json` `srs.defaultMode`
  - "Recap" mode should generate directly without confirmation dialog

- [x] **3.5 — Category focus filter**
  - Right-click the plan header → "Focus: {category} only" (e.g., Trees, Graphs, DP)
  - Filters the plan to only show problems from that category
  - Show all categories available in the current study plan

- [x] **3.6 — AI-Driven Recap Plan**
  - If `state.lastActivityDate` is >7 days ago on activation AND there is at least one completed problem in the state (streaks/history exist), show welcome-back notification
  - Invoke the AI agent with state data (days absent, decayed patterns, overdue queue size, completed problems)
  - AI generates a study plan JSON (same schema as study plans) and extension writes to `.leetplus/plans/ai-recap-<date>.json`
  - Set this as the active plan in config
  - Create new skill: `lp-recap-planner` with instructions for generating comeback plans in valid JSON

---

## Phase 4: AI-First Rating Flow 🔴
> Depends on: Phase 1, Phase 2

- [x] **4.1 — Trigger rating flow on "Mark as Solved" click or successful LeetCode submission**
  - Instead of adding a redundant new button, hook into the existing "Mark as Solved" button click in the problem webview.
  - Automatically trigger the rating flow when a LeetCode submission returns "Accepted" successfully (after fixing the submit status parsing in Phase 22).
  - Register command `leetplus.completeProblem` and support keyboard shortcut `Ctrl+Shift+R` (macOS) / `Alt+R` (Win/Linux) to manually open the rating flow.

- [x] **4.2 — Implement staged rating pipeline (Amendment J)**
  - **Stage 1 (immediate, 0ms):** Call `SnapshotManager.captureSnapshot()` and update `state.json` locally. No network.
  - **Stage 2 (2s debounce):** Trigger AI auto-rating in background using the agent prompt from `config.json` `agentPromptAutoRate`
  - **Stage 3 (UI):** Open rating review panel immediately with skeleton/loading state while AI computes
  - Build the AI prompt: include solution code, elapsed time from ProblemTimer, hint count, diff patches from current session, previous snapshots, detected patterns

- [x] **4.3 — Build Rating Review Panel UI**
  - A webview card that appears after completion showing:
    - The AI's suggested rating (highlighted, e.g., `🟡 2 — Good`)
    - Rating source indicator (Amendment S): `🤖 AI Rating`, `📊 Heuristic Estimate`, or `👤 Manual`
    - The AI's justification text (1-2 sentences)
    - 5 clickable rating buttons (0=Mastered, 1=Easy, 2=Good, 3=Hard, 4=Again) so user can override
    - "Accept" button to confirm the displayed rating
  - On confirmation: call SRSEngine, update pattern mastery, update streaks, save state, move problem to "Done" in daily plan, show toast "Scheduled for review on [date]"

- [x] **4.4 — Create `HeuristicRater.ts` (Amendment I)**
  - Import and call `ComplexityBudget.ts` — check if solution's estimated complexity exceeds the expected bound for this problem
  - Import and call `ConstraintParser.ts` — extract constraints from problem description (e.g., n ≤ 10⁵)
  - Import and call `EmpiricalFit.ts` — estimate actual complexity class from runtime measurements
  - Import and call `PatternDetector.ts` — detect patterns used
  - Combine signals into a heuristic rating:
    - Complexity within budget + correct pattern → rating 1 or 2
    - Complexity exceeds budget → rating 3 or 4
    - Pattern mismatch or timeout → rating 3
  - Return `{ rating, justification, source: "heuristic" }`

- [x] **4.5 — Wire fallback into rating pipeline**
  - In the rating pipeline: try AI first with a 5-second timeout
  - If AI succeeds: use AI rating, show `🤖 AI Rating`
  - If AI fails (timeout, error, no network): run `HeuristicRater`, show `📊 Heuristic Estimate`
  - If both fail: show manual-only panel (`👤 Manual`)

- [x] **4.5b — Fix programmatic AI completion in Antigravity IDE / Cursor host (Ask Agent via file IPC)**
  - Add button in review panel when fallback to heuristic occurs
  - Open agent chat panel with context and instruction to write to `.leetplus/ai_evaluation.json`
  - Setup filesystem watcher to automatically update the review panel once agent writes evaluation
  - Ensure zero port-dependencies or external apps are required for standard users

- [x] **4.6 — Implement automatic mode toggle**
  - Read `autoRating.requireConfirmation` from config (default: `true`)
  - When `false` and rating is AI-driven: accept rating silently without showing review panel and show toast.
  - If rating is heuristic-driven (due to AI offline/bypass fallback) or `requireConfirmation` is `true`: always show the review panel for confirmation.

- [x] **4.7 — Hint penalty tracking**
  - [x] Store `hintsUsed` per problem per session (reset on new session, or read from `.hint` coaching keys count)
  - [x] Pass `hintsUsed` to AI prompt and HeuristicRater
  - [x] AI prompt and HeuristicRater hint penalty: 0 hints = neutral, 1-2 = slight penalty, 3+ = at most rating 2
  - [x] Wire `<details>` toggle events in problem webview to increment hintsUsed (Deferred to Phase 6 / Task 6.5)

---

## Phase 4a: Test Coverage 🔴
> Depends on: Phase 4

### 4a.0 — Migrate test runner from node:test/tsx to Vitest
- [x] **4a.0.1 — Install and configure Vitest**
  - `npm install --save-dev vitest @vitest/coverage-v8`
  - Create `vitest.config.ts` at repo root with:
    - `environment: 'node'`
    - `include: ['test/**/*.test.ts']`
    - `coverage: { reporter: ['text', 'html'], include: ['src/**/*.ts'], exclude: ['src/extension.ts', 'src/**/interface/**'] }`
  - Add `"test": "vitest run"` and `"test:watch": "vitest"` and `"test:coverage": "vitest run --coverage"` to `package.json` scripts
  - Remove old `tsx --import` runner from `package.json` test script
- [x] **4a.0.2 — Migrate all existing test files to Vitest API**
  - Replace `import { describe, it, before, after } from "node:test"` → `import { describe, it, beforeEach, afterEach, beforeAll, afterAll, expect, vi } from "vitest"`
  - Replace `import assert from "node:assert"` → use `expect()` assertions throughout
  - Replace `assert.strictEqual(a, b)` → `expect(a).toBe(b)`
  - Replace `assert.deepStrictEqual(a, b)` → `expect(a).toEqual(b)`
  - Replace `assert.ok(v)` → `expect(v).toBeTruthy()`
  - Update `before()`/`after()` → `beforeAll()`/`afterAll()`
  - Run `npm test` to confirm all existing tests still pass
- [x] **4a.0.3 — Update vscode mock for Vitest**
  - Verify the existing `node_modules/vscode/index.js` mock works with Vitest's module resolution
  - Add `alias: { vscode: path.resolve('./node_modules/vscode') }` to vitest config if needed
  - Confirm mocked tests (statusBarManager, diffLogger) still pass

---

### 4a.1 — New test file: `test/workspaceInit.test.ts`
> Tests `leetplus.initializeWorkspace` logic by calling the underlying `fs` operations in a temp directory.

- [x] **4a.1.1 — Fresh workspace: directory and subdir creation**
  - Create a temp dir with no `.leetplus/`
  - Call the init logic
  - Assert `.leetplus/` directory exists
  - Assert all 7 subdirs exist: `snapshots/`, `diffs/`, `guides/`, `designs/`, `behavioral/`, `plans/`, `whiteboard/`

- [x] **4a.1.2 — Fresh workspace: config.json created with default content**
  - Assert `.leetplus/config.json` exists
  - Assert content contains `"language": "typescript"`
  - Assert content is valid JSON

- [x] **4a.1.3 — Fresh workspace: state.json initialized**
  - Assert `.leetplus/state.json` exists after init
  - Assert `readState()` returns a valid state with `version: "1.0"` and empty `problems: []`
  - Assert `planName` is `"My Practice Plan"`

- [x] **4a.1.4 — Idempotent re-init: existing files not overwritten**
  - Pre-create `.leetplus/config.json` with custom content `{"language": "python"}`
  - Pre-create `.leetplus/state.json` with valid state
  - Run init again
  - Assert `config.json` still contains `python` (not overwritten)
  - Assert `state.json` is unchanged

- [x] **4a.1.5 — Idempotent re-init: missing subdirs created, existing ones untouched**
  - Pre-create `.leetplus/` with only `snapshots/` present
  - Run init
  - Assert all 7 subdirs now exist
  - Assert `snapshots/` was not deleted and recreated (stat mtime unchanged)

- [x] **4a.1.6 — `.leetplus` exists as a file, not a directory**
  - Write a file at the path where `.leetplus/` should be
  - Run init
  - Assert the file was deleted
  - Assert `.leetplus/` is now a directory with all subdirs
  - Assert `config.json` and `state.json` are created

- [x] **4a.1.7 — No workspace folder open**
  - Mock `vscode.workspace.workspaceFolders` to return `undefined`
  - Assert `showErrorMessage("Please open a workspace folder first.")` is called
  - Assert no files or directories are created

---

### 4a.2 — New test file: `test/agentSkillsInstall.test.ts`
> Tests `ensureCursorLeetPlusPluginInstalled` from `src/modules/CursorLeetPlusPluginInstall.ts`.

- [x] **4a.2.1 — First-time Cursor install: all files created**
  - Point `CURSOR_PLUGINS_DIR` to a temp directory
  - Assert 4 SKILL.md files created: `lp-interview-generator/SKILL.md`, `lp-dsa-hint/SKILL.md`, `lp-dsa-analyze/SKILL.md`, `lp-recap-planner/SKILL.md`
  - Assert `.cursor-plugin/plugin.json` created
  - Assert `writeIfDifferent` returns `"created"` for each

- [x] **4a.2.2 — Cursor skills unchanged on second run**
  - Run install twice
  - Assert no files were written on the second call (all return `"unchanged"`)
  - Assert no error or notification on second run

- [x] **4a.2.3 — Cursor skill content updated when changed**
  - Manually write a modified version of one SKILL.md
  - Run install
  - Assert file was overwritten with canonical content
  - Assert `writeIfDifferent` returns `"updated"` for that file

- [x] **4a.2.4 — First-time Antigravity workspace install: skill files created**
  - Mock workspace folder pointing to a temp dir
  - Assert `.agents/skills/lp-dsa-hint/SKILL.md` created
  - Assert `.agents/skills/lp-dsa-analyze/SKILL.md` created
  - Assert `.agents/skills/lp-interview-generator/SKILL.md` created
  - Assert `.agents/skills/lp-recap-planner/SKILL.md` created

- [x] **4a.2.5 — Antigravity skill unchanged: no notification shown**
  - Pre-write all 4 skill files with canonical content
  - Run install
  - Assert `vscode.window.showInformationMessage` was NOT called
  - Assert no files were overwritten

- [x] **4a.2.6 — Antigravity skill diverged + user clicks "Overwrite"**
  - Pre-write one skill file with custom content
  - Mock `showInformationMessage` to return `"Overwrite"`
  - Run install
  - Assert the modified file is now overwritten with canonical content
  - Assert no `.bak` file created

- [x] **4a.2.7 — Antigravity skill diverged + user clicks "Backup & Overwrite"**
  - Pre-write one skill file with custom content `"MY CUSTOM CONTENT"`
  - Mock `showInformationMessage` to return `"Backup & Overwrite"`
  - Run install
  - Assert `.bak` file exists with `"MY CUSTOM CONTENT"`
  - Assert original file now has canonical content
  - Assert success notification was shown

- [x] **4a.2.8 — Antigravity skill diverged + user clicks "Skip"**
  - Pre-write one skill file with custom content
  - Mock `showInformationMessage` to return `"Skip"`
  - Run install
  - Assert skill file is NOT overwritten (still has custom content)

- [x] **4a.2.9 — Antigravity skill diverged + user dismisses dialog**
  - Mock `showInformationMessage` to return `undefined`
  - Run install
  - Assert skill file is NOT overwritten

- [x] **4a.2.10 — Notification suppressed via config**
  - Pre-write one skill file with custom content
  - Set `leetplus.suppressSkillUpdateNotification: true` in VS Code settings mock
  - Run install
  - Assert `showInformationMessage` was NOT called
  - Assert skill file is silently overwritten

- [x] **4a.2.11 — Copilot instructions file created**
  - Mock workspace folder to a temp dir with no `.github/`
  - Run install
  - Assert `.github/copilot-instructions.md` created
  - Assert content contains merged skill content from all 4 skills

- [x] **4a.2.12 — Copilot instructions not overwritten when unchanged**
  - Pre-write `.github/copilot-instructions.md` with canonical content
  - Run install
  - Assert file was NOT rewritten (mtime unchanged)

- [x] **4a.2.13 — No workspace folder: workspace-level portion skipped**
  - Mock `vscode.workspace.workspaceFolders` to return `undefined`
  - Run install
  - Assert no `.agents/` or `.github/` files are created
  - Assert Cursor global install still runs (SKILL.md files created in temp Cursor dir)

---

### 4a.3 — New test file: `test/heuristicRater.test.ts`
> Tests `estimateRating` from `src/modules/HeuristicRater.ts`.

- [x] **4a.3.1 — Returns correct shape `{ rating, justification, source, patternsDetected }`**
  - Pass any valid code + description
  - Assert result has all 4 fields
  - Assert `source === "heuristic"`
  - Assert `rating` is a number in [0, 4]

- [x] **4a.3.2 — Empty / placeholder code → rating 4**
  - Pass code shorter than 40 chars (e.g., `"pass"` or `"return [];"`)
  - Assert `rating === 4`
  - Assert justification mentions "placeholder" or "incomplete"

- [x] **4a.3.3 — Solution within complexity budget → rating 1 or 2**
  - Provide a problem description with `n ≤ 10^5` constraint
  - Provide a TypeScript solution with a single `for` loop (O(n))
  - Assert `rating <= 2`

- [x] **4a.3.4 — Solution exceeds complexity budget → rating 3**
  - Provide a problem description with `n ≤ 10^5` constraint
  - Provide a TypeScript solution with nested `for` loops (O(n²))
  - Assert `rating === 3`

- [x] **4a.3.5 — 0 hints: no penalty applied**
  - Call with `hintsUsed = 0`
  - Record base rating
  - Assert rating matches the complexity-only rating (no bump)

- [x] **4a.3.6 — 1-2 hints: mild penalty — rating 0 bumped to 1, rating 1 bumped to 2**
  - Provide a clean O(n) solution that would otherwise rate 0 or 1
  - Call with `hintsUsed = 2`
  - Assert rating is at least 1 (or 2 respectively)

- [x] **4a.3.7 — 3+ hints: cap — rating 0 or 1 forced to 2**
  - Call with `hintsUsed = 5` on a clean O(n) solution
  - Assert `rating >= 2`

---

### 4a.4 — New test file: `test/leetPlusConfig.test.ts`
> Tests pure helper functions in `src/modules/LeetPlusConfig.ts`.

- [x] **4a.4.1 — `inferListSourceForSlug`: slug in studyPlans only → `"studyPlan"`**
- [x] **4a.4.2 — `inferListSourceForSlug`: slug in problemLists only → `"problemList"`**
- [x] **4a.4.3 — `inferListSourceForSlug`: slug in both → `"studyPlan"` (prefers studyPlan)**
- [x] **4a.4.4 — `inferListSourceForSlug`: slug in neither → `"studyPlan"` (default)**
- [x] **4a.4.5 — `reconcileListSource`: stale `"studyPlan"` when slug only in problemLists → corrected to `"problemList"`**
- [x] **4a.4.6 — `reconcileListSource`: stale `"problemList"` when slug only in studyPlans → corrected to `"studyPlan"`**
- [x] **4a.4.7 — `reconcileListSource`: source matches actual location → returned unchanged**
- [x] **4a.4.8 — `resolveDefaultStudyPlanSlug`: valid `activeStudyPlan` present in list → returned as-is**
- [x] **4a.4.9 — `resolveDefaultStudyPlanSlug`: invalid slug not in list → first plan's slug returned**
- [x] **4a.4.10 — `resolveDefaultStudyPlanSlug`: empty studyPlans array → hardcoded `"top-interview-150"` returned**
- [x] **4a.4.11 — `resolveDefaultProblemListSlug`: valid `activeProblemList` → returned**
- [x] **4a.4.12 — `resolveDefaultProblemListSlug`: legacy migration path (`activeListSource:"problemList"` + `activeStudyPlan`) → migrated slug returned**
- [x] **4a.4.13 — `parseStudyPlans` (via `parseConfig`): entries missing `slug` or `name` → filtered out, valid ones kept**
- [x] **4a.4.14 — `parseStudyPlans` (via `parseConfig`): empty array `[]` → falls back to DEFAULTS.studyPlans**

---

### 4a.5 — Expand `test/stateManager.test.ts`

- [x] **4a.5.1 — `readState` returns `null` when state.json does not exist**
- [x] **4a.5.2 — `readState` returns `null` for invalid JSON content (corrupted file)**
- [x] **4a.5.3 — `readState` returns `null` for valid JSON but missing `version` field**
- [x] **4a.5.4 — `readState` returns `null` for valid JSON but `problems` is not an array**
- [x] **4a.5.5 — `writeState` creates `.leetplus/` dir if it does not exist**
- [x] **4a.5.6 — After `writeState`, no `.tmp` file is left on disk (atomic rename verified)**
- [x] **4a.5.7 — `initState` with `planSlug` parameter → `state.planSlug` field is set correctly**
- [x] **4a.5.8 — `initState` with non-empty `problems` array → all problems present in written state**
- [x] **4a.5.9 — Written state file uses 2-space indentation (file format verification)**

---

### 4a.6 — Expand `test/statusBarManager.test.ts`

- [x] **4a.6.1 — `updateStatusBar` when `statusBarItem` not yet initialized → no throw, returns early**
- [x] **4a.6.2 — `updateStatusBar` with no workspace folders → `hide()` called**
- [x] **4a.6.3 — `updateStatusBar` with workspace folder but no `.leetplus/` dir → `hide()` called**
- [x] **4a.6.4 — `updateStatusBar` when `readState` returns `null` → `hide()` called**
- [x] **4a.6.5 — `updateStatusBar` with `currentStreak = 0` and `dueCount = 0` → text is `"🔥 0 | 📋 0 due"`, `show()` called**
- [x] **4a.6.6 — `updateStatusBar` with non-zero streak → streak number displayed correctly**
- [x] **4a.6.7 — `updateStatusBar` with multiple due problems → count shown correctly**

---

### 4a.7 — Expand `test/diffLogger.test.ts`

- [x] **4a.7.1 — `config.enabled = false` → `initDiffLogger` registered but no patch files ever created on any change**
- [x] **4a.7.2 — Untracked file extension (`.rb`) → no patch file created even on large change**
- [x] **4a.7.3 — `triggerMode = "time"` → large change (> charThreshold) does NOT immediately trigger; patch only appears after debounce wait**
- [x] **4a.7.4 — `triggerMode = "change"` → small change (< charThreshold) does NOT trigger; large change fires immediately without waiting for debounce**
- [x] **4a.7.5 — `saveDiff` when `baselineText === currentText` → no patch file written**
- [x] **4a.7.6 — Baseline updated after `saveDiff`: identical second edit does not write another patch**
- [x] **4a.7.7 — `accumulatedChanges` reset to 0 after a save (verified via next threshold boundary)**

---

### 4a.8 — Expand `test/srsEngine.test.ts`

- [x] **4a.8.1 — `calculateNextInterval`: rating 1 at level 99 → level stays at 99 (cap enforced)**
- [x] **4a.8.2 — `calculateNextInterval`: negative `currentLevel` (e.g., -5) → clamped to 0**
- [x] **4a.8.3 — `calculateNextInterval`: rating 99 (out-of-range) → default case: interval=1, level=0**
- [x] **4a.8.4 — `calculateStreaks`: single date in history → currentStreak=1, bestStreak=1**
- [x] **4a.8.5 — `calculateStreaks`: two problems solved on same day → date deduplicated, still streak=1**
- [x] **4a.8.6 — `calculatePatternMastery`: `currentScore = 1.0` + success → still clamped to 1.0**
- [x] **4a.8.7 — `calculatePatternMastery`: `currentScore = 0.0` + failure → still clamped to 0.0**
- [x] **4a.8.8 — `getDueProblems`: status `"skipped"` + `nextRepetitionDate` in past → included**
- [x] **4a.8.9 — `getDueProblems`: empty `problems` array → returns `[]`**

---

### 4a.9 — Expand `test/snapshotManager.test.ts`

- [x] **4a.9.1 — `captureSnapshot` when `readState` returns null → throws**
- [x] **4a.9.2 — `captureSnapshot` when problem not found by slug → throws**
- [x] **4a.9.3 — `captureSnapshot` when solution file does not exist → throws**
- [x] **4a.9.4 — `captureSnapshot` with rating=0 (Mastered) → `repetitionLevel=99`, `status="completed"`**
- [x] **4a.9.5 — `captureSnapshot` with rating=4 (Again) → `repetitionLevel=0`, pattern mastery outcome is `"failure"`**
- [x] **4a.9.6 — `finalizeProblemRating` when state is null → throws**
- [x] **4a.9.7 — `finalizeProblemRating` when problem not found → throws**
- [x] **4a.9.8 — `finalizeProblemRating` when `completionHistory` is empty → throws**
- [x] **4a.9.9 — Multiple snapshots on same problem: `getLatestSnapshot` returns most recent (sort order verified)**

---

### 4a.10 — Expand `test/leetPlusConfigEditor.test.ts`

- [x] **4a.10.1 — `parseConfig` with invalid JSON → returns DEFAULTS without throwing**
- [x] **4a.10.2 — `parseConfig` with whitespace-only input → returns DEFAULTS**
- [x] **4a.10.3 — `parseConfig` with `studyPlans: []` (empty array) → falls back to DEFAULTS.studyPlans**
- [x] **4a.10.4 — `parseConfig` with `studyPlans` containing entries missing `slug` field → invalid entries filtered out**
- [x] **4a.10.5 — `parseConfig` with unsupported `language` value (e.g., `"rust"`) → falls back to default language**
- [x] **4a.10.6 — `parseConfig` with invalid `srs.defaultMode` string → falls back to `"interleaved"`**
- [x] **4a.10.7 — `parseConfig` with invalid `diffRetention` string → falls back to `"session"`**
- [x] **4a.10.8 — `configToJson` round-trip: parse → serialize → content is valid JSON with 2-space indent**

---

### 4a.11 — Expand `test/studyPlanSwitcher.test.ts`

- [x] **4a.11.1 — User cancels the confirmation dialog (`showInformationMessage` returns `undefined`) → returns `"cancelled"`**
- [x] **4a.11.2 — User cancels the QuickPick for old-problem disposition → all old problems treated as "keep"**
- [x] **4a.11.3 — Switch when plan has zero old-only problems → no QuickPick shown, switches directly**
- [x] **4a.11.4 — Seed fetch returns empty array → state has 0 problems, returns `"switched"`**

---

### 4a.12 — Expand `test/pattern-detector.test.ts`

- [x] **4a.12.1 — Empty source string → returns `[]`, no throw**
- [x] **4a.12.2 — Source shorter than 20 chars → returns `[]` (short-circuit)**
- [x] **4a.12.3 — `slidingWindow` pattern detected**
- [x] **4a.12.4 — `dfsRecursive` pattern detected (standalone, no DP)**
- [x] **4a.12.5 — `backtracking` pattern detected**
- [x] **4a.12.6 — `greedy` pattern detected**
- [x] **4a.12.7 — `topoSort` pattern detected**
- [x] **4a.12.8 — `bitManipulation` pattern detected**
- [x] **4a.12.9 — `hashMapSet` pattern detected**
- [x] **4a.12.10 — `treeTraversal` pattern detected**
- [x] **4a.12.11 — `dpTopDown` present → `dfsRecursive` suppressed (shadow rule)**
- [x] **4a.12.12 — Multiple patterns in one file → all detected**
- [x] **4a.12.13 — Source with only comments → returns `[]` (comments stripped)**

---

### 4a.13 — New test file: `test/interviewMode.test.ts`

- [x] **4a.13.1 — `startInterviewSession` with valid args → session written to memento, `setInterviewContext(true)` called**
- [x] **4a.13.2 — `startInterviewSession` with duplicate planned slugs → deduplicated**
- [x] **4a.13.3 — `recordInterviewSolve` idempotency: same slug solved twice → only recorded once**
- [x] **4a.13.4 — `endInterviewSession` with no active session → returns null**
- [x] **4a.13.5 — `endInterviewSession` awards correct XP per difficulty (EASY=10, MEDIUM=20, HARD=40)**
- [x] **4a.13.6 — `endInterviewSession` perfect-set bonus when all planned slugs solved**
- [x] **4a.13.7 — `endInterviewSession` clears session from memento, calls `setInterviewContext(false)`**
- [x] **4a.13.8 — `migrateRawSession`: old `plannedSlugs` array format → migrated to `plannedProblems`**
- [x] **4a.13.9 — `migrateRawSession`: invalid `attemptHex` (wrong format) → field set to undefined**
- [x] **4a.13.10 — `pickPlannedInterviewProblems`: returns `count` problems, prefers unsolved over solved**
- [x] **4a.13.11 — `pickPlannedInterviewProblems`: count=0 → returns `[]`**
- [x] **4a.13.12 — `remainingMs` with expired session → returns 0 (not negative)**

---

### 4a.14 — New test file: `test/patternMastery.test.ts`

- [x] **4a.14.1 — `recordSolveForPatterns`: first solve for a pattern → credits pattern, count=1**
- [x] **4a.14.2 — `recordSolveForPatterns`: same slug solved again → count NOT incremented (idempotent per-slug)**
- [x] **4a.14.3 — `recordSolveForPatterns`: different slug same pattern → count incremented**
- [x] **4a.14.4 — `recordSolveForPatterns`: empty patterns array → early return, no state written**
- [x] **4a.14.5 — `computeMastery`: solvedCount=0 → returns 0**
- [x] **4a.14.6 — `computeMastery`: recent solve (day=0) → no decay, value close to `(1-1/(1+count))*0.5^0`**
- [x] **4a.14.7 — `computeMastery`: old solve (day=21) → value halved (half-life=21 days)**
- [x] **4a.14.8 — `summarizePatternMastery`: pattern with 0 solves → rank `"untouched"`**
- [x] **4a.14.9 — `summarizePatternMastery`: pattern with mastery < 0.2 → rank `"rusty"`**
- [x] **4a.14.10 — `pickWeakestPattern`: returns untouched pattern first when one exists**
- [x] **4a.14.11 — `pickWeakestPattern`: empty state → returns undefined**

---

### 4a.15 — New test file: `test/gamification.test.ts`

- [x] **4a.15.1 — `xpForDifficultyLabel("Easy")` → 10**
- [x] **4a.15.2 — `xpForDifficultyLabel("Medium")` → 20**
- [x] **4a.15.3 — `xpForDifficultyLabel("Hard")` → 40**
- [x] **4a.15.4 — `xpForDifficultyLabel("unknown")` → 15 (default)**
- [x] **4a.15.5 — `xpLevelProgress`: 0 XP → level 1, xpInLevel=0**
- [x] **4a.15.6 — `xpLevelProgress`: XP at exact level boundary → correct level and xpInLevel=0**
- [x] **4a.15.7 — `awardXpForFirstSolve`: first solve awards XP, returns XP amount > 0**
- [x] **4a.15.8 — `awardXpForFirstSolve`: same slug twice → returns 0 (idempotent)**
- [x] **4a.15.9 — `awardXpForFirstSolve`: XP amount matches `xpForDifficultyLabel` for that difficulty**
- [x] **4a.15.10 — `grantDailyLoginXpIfNeeded`: first call today → grants 1 XP, returns 1**
- [x] **4a.15.11 — `grantDailyLoginXpIfNeeded`: second call same day → returns 0 (already granted)**
- [x] **4a.15.12 — `addBonusXp`: amount > 0 → total XP increased**
- [x] **4a.15.13 — `addBonusXp`: amount = 0 or negative → no-op, total XP unchanged**
- [x] **4a.15.14 — `setDailyGoal`: invalid mode → throws**
- [x] **4a.15.15 — `setDailyGoal`: target > 1000 → throws**
- [x] **4a.15.16 — `dailyGoalProgressPercent`: over 100% → clamped to 100**

---

### 4a.16 — Expand `test/dailyPlanGenerator.test.ts`

- [x] **4a.16.1 — `generateDailyPlan` when state is null → does not throw; returns empty plan**
- [x] **4a.16.2 — `generateDailyPlan` with `srs.enabled = false` → all pending problems included regardless of SRS scheduling**
- [x] **4a.16.3 — Plan file written to `.leetplus/plans/<today>.json` → file exists and is valid JSON after `generateDailyPlan`**
- [x] **4a.16.4 — Recap mode with no completed problems → falls back to random completed or empty**
- [x] **4a.16.5 — `bootstrapStateFromStudyPlan`: fetch throws → returns 0, no state written**
- [x] **4a.16.6 — `loadSeedsFromLocalDataFile`: file doesn't exist → returns null**
- [x] **4a.16.7 — `loadSeedsFromLocalDataFile`: file has invalid JSON → returns null**

---

## Phase 4b: Test Quality Fixes 🔴
> Depends on: Phase 4a
> Source: Audit findings from session 60913b16. All 253 existing tests pass, but two tests are
> provably wrong (exercise no actual assertion), and three logic-rich modules have no tests.

### 4b.1 — Fix `test/heuristicRater.test.ts` vacuous hint-penalty test
- [x] **4b.1.1 — Fix "1-2 hints: mild penalty" test (task 4a.3.6)**
  - Current bug: uses `NESTED_SOLUTION` (O(n²), produces `rating=3`) as the base. The hint
    penalty code only adjusts `rating` 0 or 1, so the `if (resultNoHints.rating <= 1)` guard
    is always false and the `expect` is skipped vacuously.
  - Fix: switch base solution to `LINEAR_SOLUTION` (O(n) hashmap) so base `rating=1`.
    Call with `hintsUsed=2` and assert `resultTwoHints.rating > resultNoHints.rating` unconditionally.
  - After fix, run `npm test` — this test must now exercise the branch and pass.
- [x] **4b.1.2 — Fix "3+ hints: cap" test (task 4a.3.7)**
  - Verify the same input change makes 4b.1.1 and 4a.3.7 both exercise the actual penalty code.
  - Assert `rating >= 2` unconditionally (no conditional guard).

---

### 4b.2 — New test file: `test/lcInterviewFile.test.ts`
> Tests `src/modules/LcInterviewFile.ts` — pure JSON parsing/validation, no vscode import.
- [x] **4b.2.1 — `parseLcInterviewFile`: valid v1 JSON → `{ ok: true, data: ... }`**
  - Pass a JSON string with `version:1`, `name`, `durationMinutes:45`, one problem.
  - Assert returned object has all fields typed correctly.
- [x] **4b.2.2 — `parseLcInterviewFile`: unknown `version` field → `{ ok: false, message }`**
  - Pass `{ version: 99, ... }`. Assert `ok === false` and message contains "version".
- [x] **4b.2.3 — `parseLcInterviewFile`: `durationMinutes` not in allowlist (45/60/180) → `ok: false`**
  - Pass `durationMinutes: 30`. Assert validation rejects it.
- [x] **4b.2.4 — `parseLcInterviewFile`: problems as array of strings → normalized to `PlannedInterviewProblem[]`**
  - Pass `problems: ["two-sum", "three-sum"]`. Assert each normalized to `{ titleSlug, difficulty: "MEDIUM" }`.
- [x] **4b.2.5 — `parseLcInterviewFile`: problems as array of objects → passed through**
  - Pass `problems: [{ titleSlug: "two-sum", difficulty: "Medium" }]`. Assert `difficulty` preserved.
- [x] **4b.2.6 — `parseLcInterviewFile`: `tags` with entries > 64 chars or > 16 items → filtered/capped**
  - Pass mix of valid tags and one too long (> 64 chars). Assert only valid kept, total capped at 16.
- [x] **4b.2.7 — `parseLcInterviewFile`: `attempts[].id` not matching `ATTEMPT_ID_RE` → stripped**
  - Pass attempt with `id: "gg9"` (valid) and `id: "zzzz"` (invalid). Assert invalid not in result.
- [x] **4b.2.8 — `defaultInterviewNameFromDate` returns `YYYY-MM-DD` format**
  - Assert output matches `/^\d{4}-\d{2}-\d{2}$/`.

---

### 4b.3 — New test file: `test/lcInterviewReportStore.test.ts`
> Tests `src/modules/LeetPlusInterviewReportStore.ts` — atomic file I/O, no vscode import.
- [x] **4b.3.1 — `writeInterviewReportAtPath` then `readInterviewReportFile` → round-trip data integrity**
  - Use `mkdtempSync` for isolation. Write report with all fields, read back, assert deep equality.
- [x] **4b.3.2 — `readInterviewReportFile` on non-existent path → `undefined`, no throw**
- [x] **4b.3.3 — `readInterviewReportFile` on corrupted JSON → `undefined`, no throw**
- [x] **4b.3.4 — `atomicWriteJsonSync`: no `.tmp` file left on disk after a successful write**
  - Verify sibling `.tmp` is cleaned up after rename completes.

---

### 4b.4 — New test file: `test/bugReviewStore.test.ts`
> Tests `src/modules/BugReviewStore.ts` — SRS-scheduled bug review queue with interval ladder [3,7,30,90].
- [x] **4b.4.1 — `addBugReview`: writes a review entry; appears in `listDueReviews` when `nextDueAt` is past**
  - Use `mkdtempSync` for isolation (override `BUG_REVIEWS_FILE` path).
  - Assert entry present when `nextDueAt` is yesterday's date.
- [x] **4b.4.2 — `listDueReviews`: entry with future `nextDueAt` not returned**
  - Create two entries: one due yesterday, one due tomorrow. Assert only the past-due one returned.
- [x] **4b.4.3 — `markReviewed`: advances `nextDueAt` by the next SRS interval step**
  - Mark fresh entry (intervalDays=3) as reviewed. Assert `nextDueAt` is 7 days in the future.
- [x] **4b.4.4 — `markReviewed` on unknown id → no throw, store unchanged**
- [x] **4b.4.5 — `readBugReviews` on corrupted file → returns empty store, no throw**

---

## Phase 4c: Extension Host Integration Tests 🔴
> Depends on: Phase 4a, Phase 4b
> Uses `@vscode/test-cli` to run tests inside a real VS Code extension host process.
> These catch wiring bugs (command IDs, tree providers, custom editors) that Vitest cannot.

### 4c.1 — Setup `@vscode/test-cli`
- [ ] **4c.1.1 — Install dependencies**
  - `npm install --save-dev @vscode/test-cli @vscode/test-electron`
  - Verify versions appear in `package.json` devDependencies.
- [ ] **4c.1.2 — Create `.vscode-test.mjs` config**
  - Set `extensionDevelopmentPath` to workspace root.
  - Set `files` to `test/e2e/**/*.test.ts`.
  - Configure `workspaceFolder` to point at a fixture workspace with `.leetplus/config.json`.
- [ ] **4c.1.3 — Add scripts to `package.json`**
  - `"test:e2e": "vscode-test"` — runs the extension host suite.
  - `"test:all": "npm test && npm run test:e2e"` — runs both suites in sequence.
- [ ] **4c.1.4 — Create `test/e2e/` directory and `tsconfig.e2e.json`**
  - Separate tsconfig that includes `test/e2e/**` and uses `@types/vscode`.
  - Add a fixture workspace at `test/fixtures/sample-workspace/.leetplus/config.json`.
- [ ] **4c.1.5 — Verify CI-friendliness**
  - Confirm `vscode-test` with `--headless` flag works on macOS without a display server.
  - Document in CONTRIBUTING.md how to run the suite locally and in CI.

---

### 4c.2 — Extension activation tests
- [ ] **4c.2.1 — Extension activates without error on a LeetPlus workspace**
  - Open the fixture workspace (has `.leetplus/config.json`).
  - Assert the extension activates (no unhandled exception in `activate()`).
  - Assert `vscode.extensions.getExtension("ravikiranp123.leet-plus")?.isActive === true`.
- [ ] **4c.2.2 — All commands in `package.json` are registered**
  - Read `contributes.commands` from `package.json` programmatically.
  - For each command ID, call `vscode.commands.getCommands()` and assert the ID is present.
  - This catches any typo between the manifest and `registerCommand` calls in `activate()`.

---

### 4c.3 — Tree provider wiring tests
- [ ] **4c.3.1 — Daily plan tree view is registered and returns items**
  - In the fixture workspace, initialize a state with 2 pending problems.
  - Assert `vscode.window.createTreeView("leetplus-daily-plan", ...)` resolves.
  - Call `getChildren(undefined)` on the provider and assert at least one item is returned.
- [ ] **4c.3.2 — Tree items have correct `contextValue`**
  - Assert each problem item has `contextValue` matching what the menu `when` clauses expect
    (e.g., the string used in `"when": "viewItem == leetplus.problemItem"`).
  - This catches the silent "right-click menu disappears" class of bugs.

---

### 4c.4 — Status bar update tests
- [ ] **4c.4.1 — Status bar shows correct text after workspace initialization**
  - Initialize a LeetPlus workspace with 3 due problems and streak=5.
  - Wait for the status bar to update (poll with a short timeout).
  - Assert the status bar text contains `🔥 5` and `📋 3 due`.
- [ ] **4c.4.2 — Status bar hides when workspace folder removed**
  - Trigger a workspace folders change to remove the folder.
  - Assert the item is no longer visible (text cleared or `hide()` called).

---

### 4c.5 — Custom editor resolution tests
- [ ] **4c.5.1 — `.leetplus/config.json` opens in the custom editor (not plain text)**
  - Open the fixture workspace's `.leetplus/config.json`.
  - Assert the active editor's `viewType` is `"leetplus.configEditor"`.
- [ ] **4c.5.2 — `*.lcInterview` file opens in the LC Interview custom editor**
  - Create a temporary `.lcInterview` file in the fixture workspace.
  - Open it and assert `viewType === "leetplus.lcInterviewEditor"`.

---

## Phase 4d: Codebase Health — extension.ts Refactoring 🔴
> Depends on: Phase 4a, Phase 4b, Phase 4c
> ⚠️ Tasks 4d.1–4d.6 are in stash@{0} ("refactor"). NOT yet committed.
> extension.ts is still 4,611 lines; src/commands/ does not exist on the current branch.

- [ ] **4d.1 — Extract custom editors registration**
  - Create `src/modules/CustomEditors.ts`
  - Move registrations for `leetplus.configEditor`, `leetplus.lcInterviewEditor`, `leetplus.lcInterviewReportEditor`, and `HintEditorProvider.viewType`
  - Export a single function `registerCustomEditors(context: vscode.ExtensionContext, getProvider: () => IProblemProvider)` to be called in `activate()`
- [ ] **4d.2 — Extract UI navigation and layout commands**
  - Create `src/commands/layout.ts`
  - Move layout/navigation command registrations: `leetplus.focusModeEnter`, `leetplus.focusModeExit`, `leetplus.toggleSidebar`, `leetplus.nextProblem`, `leetplus.prevProblem`, etc.
  - Export `registerLayoutCommands(context: vscode.ExtensionContext)`
- [ ] **4d.3 — Extract AI & Solution Rating commands**
  - Create `src/commands/agent.ts`
  - Move commands: `leetplus.agentHint`, `leetplus.agentAnalyze`, `leetplus.completeProblem`
  - Extract helper functions `applyHintPenaltyToRating` and evaluation flow logic
  - Export `registerAgentCommands(context: vscode.ExtensionContext, getProvider: () => IProblemProvider, ...)`
- [ ] **4d.4 — Extract Workspace & Session initialization commands**
  - Create `src/commands/workspace.ts`
  - Move commands: `leetplus.initializeWorkspace`, `leetplus.switchStudyPlan`, etc.
  - Export `registerWorkspaceCommands(context: vscode.ExtensionContext, getProvider: () => IProblemProvider, ...)`
- [ ] **4d.5 — Simplify extension.ts (Initial)**
  - [ ] Re-export `activate` and `deactivate` functions
  - [ ] Thin activation logic: import and call the registry helpers
  - [ ] Run compiler typecheck to verify zero regression
- [ ] **4d.6 — Extract Interview commands**
  - Create `src/commands/interview.ts`
  - Move commands: `leetplus.interviewModeStart`, `leetplus.interviewModeStop`, `leetplus.openLcInterviewReportForPath`, `leetplus.openLcInterviewReportFile`, `leetplus.interviewGenerateWithAi`
  - Move helpers: `showInterviewSessionEnded`, `plannedProblemsFromSetup`, `runInterviewSessionAfterPlan`, `startInterviewTick`, `stopInterviewTick`, `refreshInterviewStatusBarNow`, `restoreInterviewOnActivate`, `handleProblemSolved`, `detectAndRecordPatternMastery`, `sanitizeInterviewDirectoryName`, `generateUniqueAttemptHex`
  - Export `registerInterviewCommands(context: vscode.ExtensionContext, getProvider: () => IProblemProvider)`
- [ ] **4d.7 — Extract Runner/Test/Visualize commands**
  - Create `src/commands/runner.ts`
  - Move commands: `leetplus.runExamples`, `leetplus.measureComplexity`, `leetplus.visualizeRecursion`, `leetplus.visualizeIterative`, `leetplus.fuzzVsBruteForce`, `leetplus.complexityBudget`, `leetplus.runAdversarialTests`, `leetplus.lint`, `leetplus.toggleInlineDecorations`, `leetplus.clearInlineDecorations`, `leetplus.runInTerminal`, `leetplus.openNextBugReview`
  - Export `registerRunnerCommands(context: vscode.ExtensionContext)`
- [ ] **4d.8 — Extract Sidebar search/filter/refresh commands**
  - Create `src/commands/sidebar.ts`
  - Move commands: `leetplus.openProblem`, `leetplus.openQotd`, `leetplus.refreshProblems`, `leetplus.refreshContests`, `leetplus.refreshCompanies`, `leetplus.searchCompanies`, `leetplus.filterCompaniesByDifficulty`, `leetplus.openContestOnWeb`, `leetplus.switchProblemList`, `leetplus.refreshQotd`, `leetplus.filterByDifficulty`, `leetplus.searchProblems`, `leetplus.showDailyPlanProblem`, `leetplus.switchDailyPlanMode`, `leetplus.filterDailyPlanByCategory`
  - Export `registerSidebarCommands(context: vscode.ExtensionContext, getProvider: () => IProblemProvider, dailyPlanProvider: DailyPlanProvider, refreshAllProblemViews: () => void)`
- [ ] **4d.9 — Extract Auth/Cloud/Stats commands**
  - Create `src/commands/auth.ts`
  - Move commands: `leetplus.signIn`, `leetplus.signOut`, `leetplus.cloudSignIn`, `leetplus.cloudSignOut`, `leetplus.setCloudUsername`, `leetplus.pushCloudStats`, `leetplus.pullCloudStats`, `leetplus.viewStats`, `leetplus.refreshStatsData`
  - Export `registerAuthCommands(context: vscode.ExtensionContext)`
- [ ] **4d.10 — Extract Misc commands**
  - Create `src/commands/misc.ts`
  - Move commands: `leetplus.toggleDiffLogger`, `leetplus.applyTheme`, `leetplus.setDailyGoal`, `leetplus.openChatWithPrompt`
  - Export `registerMiscCommands(context: vscode.ExtensionContext)`
- [ ] **4d.11 — Final thinning & compile validation of extension.ts**
  - Call all new register hooks in `activate()`
  - Clean unused imports in `src/extension.ts`
  - Run typecheck and integration tests validation

---

## Phase 5: AI Trajectory Context 🔴
> Depends on: Phase 1, Phase 2

- [ ] **5.1 — Update agent prompt templates in config**
  - Update `agentPromptHint` to include instructions for reading `.leetplus/snapshots/{id}/` and `.leetplus/diffs/{id}/`
  - Update `agentPromptAnalyze` similarly
  - Add `agentPromptAutoRate` for the auto-rating flow
  - Add `agentPromptRecap` for comeback plan generation

- [ ] **5.2 — Rename and update skill files**
  - `lp-dsa-hint` SKILL.md: update instructions to reference `.leetplus/` paths, add snapshot/diff reading
  - `lp-dsa-analyze` SKILL.md: same updates
  - Create `lp-auto-rater` SKILL.md: instructions for returning structured `{ rating, justification, patternFeedback }` JSON
  - Create `lp-recap-planner` SKILL.md: instructions for generating valid study plan JSON from state data

- [ ] **5.3 — Context injection helper**
  - Create a utility function `buildAIContext(problemId)` that assembles:
    - Current solution code
    - Previous snapshots (reverse chronological)
    - Session diff patches
    - Elapsed time, hint count
    - Detected patterns
    - Pattern mastery scores for relevant patterns
  - This function is called by the rating pipeline, hint command, and analyze command

---

## Phase 6: Content Display 🟡
> Depends on: Phase 4

- [ ] **6.1 — Render hints in collapsible blocks**
  - In `ProblemView.ts` webview, render problem hints inside `<details><summary>Hint 1</summary>...</details>` blocks
  - Wire `<details>` toggle events to increment `hintsUsed` counter via `postMessage` bridge

- [ ] **6.2 — Render solutions with syntax highlighting**
  - Solutions inside collapsible `<details>` with syntax-highlighted code blocks
  - Use a lightweight syntax highlighter (e.g., Prism.js bundled in webview)

- [ ] **6.3 — Embed YouTube videos**
  - Add `<iframe src="https://www.youtube-nocookie.com/embed/{youtubeId}">` inside a collapsible "Video Explanation" section
  - Update webview CSP to add `frame-src https://www.youtube-nocookie.com`
  - Fallback: if iframe fails, show a "Watch on YouTube" link using `vscode.env.openExternal()`

- [ ] **6.4 — Implement solution gating**
  - Content (hints, solutions, video) locked until:
    - User has spent ≥5 minutes on the problem (read from ProblemTimer), OR
    - User has made at least 1 submission attempt
  - Show lock icon: "Attempt for 5 minutes to unlock hints"
  - Once unlocked, stays unlocked for that problem

- [ ] **6.5 — Wire details toggle hint penalty**
  - Integrate details element toggle events inside the problem view's webview to post message to extension host.
  - Increment the session `hintsUsed` counter on toggle event.
  - Connect this to update the rating penalty accordingly.

---

## Phase 7: Analytics Dashboard 🟢
> Depends on: Phase 1

- [ ] **7.1 — Create `DashboardView.ts` webview**
  - Register command `leetplus.showDashboard`
  - Create a webview panel with HTML/CSS/JS
  - Read all data from `StateManager` and existing `Gamification.ts`

- [ ] **7.2 — Overview cards row**
  - Streak, Best Streak, Problems Solved, Hours Invested, Level & XP

- [ ] **7.3 — Activity heatmap**
  - GitHub-style calendar heatmap. Aggregate all `completionHistory` dates. Color intensity = problems solved that day.
  - Use a lightweight Canvas-based renderer (no external deps)

- [ ] **7.4 — Pattern mastery radar chart**
  - Polar/radar chart from `patternMastery` scores. Highlight weakest 3 in red.

- [ ] **7.5 — Difficulty breakdown bar chart + time trend line chart**

- [ ] **7.6 — SRS calendar**
  - Shows upcoming review dates for next 30 days with counts per day

---

## Phase 8: Guide Library 🟡
> Depends on: Phase 1

- [ ] **8.1 — Create `GuideLibrary.ts`**
  - Storage: `.leetplus/guides.json` — array of `Guide` objects (id, tags, block, guide text, createdAt)
  - Implement weighted fuzzy search (block=3, content=1, tag=2)
  - Commands: `LeetPlus: Add Guide`, `LeetPlus: Search Guides`, `LeetPlus: List Guides`

- [ ] **8.2 — Auto-guide from AI**
  - After AI hint/analysis, offer a "Save as Guide" button
  - Extract the key insight, auto-tag with detected patterns

---

## Phase 9: Gauntlet Mode 🟡
> Depends on: Phase 1

- [ ] **9.1 — Create `GauntletGenerator.ts`**
  - Standard Gauntlet: 1E + 1M + 1H from unmastered problems, 45 min
  - Company Gauntlet: use CompaniesData frequency, pick top 3 for selected company
  - Weak Pattern Gauntlet: pick 3 targeting lowest pattern mastery scores
  - SRS Gauntlet: pick 3 most overdue review problems
  - Output: generate a `.lcInterview` file and open in existing InterviewMode

- [ ] **9.2 — Register commands and quick pick**
  - `LeetPlus: Start Gauntlet` → Quick pick: Standard / Company / Weak Patterns / SRS Review
  - Company option → second quick pick listing companies from CompaniesData

---

## Phase 10: Practice Environment 🟡
> Depends on: Phase 0

- [ ] **10.1 — Create `EnvironmentManager.ts`**
  - Define the canonical settings JSON (see plan Phase 10 for exact fields)
  - Key settings: `quickSuggestions` on, `parameterHints` enabled, `copilot` disabled, `inlineSuggest` disabled

- [ ] **10.2 — Multi-IDE settings write (Amendment A)**
  - Detect which IDE config folders exist: `.vscode/`, `.cursor/`, `.antigravity/`
  - Also check `process.env` for IDE indicators
  - Write the identical settings JSON to `settings.json` in each detected folder
  - Don't overwrite existing settings — merge (only set keys that aren't already set, or use a "managed by LeetPlus" comment marker)

- [ ] **10.3 — Keybinding contributions**
  - Contribute keybindings via `package.json` `contributes.keybindings`
  - Use `when` clause with `isMac` for platform-specific bindings
  - macOS: Ctrl+modifiers, Windows/Linux: Alt+modifiers (see plan table)

---

## Phase 11: Notifications 🟡
> Depends on: Phase 1, Phase 3

- [ ] **11.1 — Create `NotificationManager.ts`**
  - On activation: if SRS-due problems exist, show info notification with "Open Daily Plan" button
  - After long absence (>7 days): show welcome-back notification with "View Plan" button
  - After completing daily plan: show celebration with streak count and "Show Dashboard" button
  - All use `vscode.window.showInformationMessage()` with action buttons
  - Configurable via `notifications` in config (onActivation, onPlanComplete, welcomeBack)

---

## Phase 12: Pattern Taxonomy Merge 🟡
> Depends on: Phase 1

- [ ] **12.1 — Expand `PatternDetector.ts`**
  - Add ~20 new patterns from prep-station's taxonomy across 9 categories
  - Each new pattern needs: regex signature, display name, category
  - New patterns: Kadane's, Cyclic Sort, Dutch National Flag, Fast & Slow Pointers, Monotonic Queue, Morris Traversal, Segment Tree, Bitmask DP, Digit DP, Bidirectional Search, Dijkstra's, Prim's/Kruskal's, Grid Paths, Knapsack variants, N-Queens, LCS
  - Map all patterns to the radar chart in Phase 7

---

## Phase 12.5: Algorithm Visualization System 🟡
> Depends on: Phase 12

- [ ] **12.5.1 — Create `VisualizationRegistry.ts`**
  - Storage: `.leetplus/visualizations.json`
  - Schema: `VisualizationEntry` (patternId, source, title, description, localPath/url/htmlContent, addedBy, addedAt)
  - Ship with 5 initial bundled visualizations: Two Pointers, Sliding Window, Binary Search, BFS, DFS
  - Bundled viz are self-contained HTML/Canvas/SVG files stored in extension assets

- [ ] **12.5.2 — Create `VisualizationView.ts` webview**
  - Single webview panel. Renders bundled HTML, external URLs (iframed), or AI-generated HTML
  - Controls: play/pause, speed slider (0.25x-3x), step forward/backward, reset
  - Command: `LeetPlus: Open Pattern Visualization` → Quick pick of patterns

- [ ] **12.5.3 — Integration with problem webview**
  - A "Visualize" tab in the problem panel auto-selects based on detected pattern
  - User toggles between "Learn the pattern" (preset) and "My code" (AI-generated)

- [ ] **12.5.4 — Expand to 20 bundled visualizations**
  - Add remaining 15: dpTopDown, dpBottomUp, backtracking, greedy, heap, trie, unionFind, topoSort, monotonicStack, bitManipulation, hashMapSet, linkedList, prefixSum, treeTraversal, dfsIterative

- [ ] **12.5.5 — AI agent prompts for discovery and generation**
  - Discovery prompt: "Find a visualization for [pattern] from algorithm-visualizer.org, VisuAlgo, USFCA. Register in .leetplus/visualizations.json."
  - Generation prompt: "Generate a self-contained HTML that simulates this user's code step-by-step using their actual variable names."

---

## Phase 13: System Design — HLD & LLD 🟡
> Depends on: Phase 0

- [ ] **13.1 — Create `DesignView.ts` webview — HLD**
  - Bundle `@excalidraw/excalidraw` React component into the webview
  - Bundle `@excalidraw/mermaid-to-excalidraw` for the conversion pipeline (Amendment V)
  - Use `vscode.postMessage` bridge for save/load of `.excalidraw` files to `.leetplus/designs/`
  - Webview layout: Left = Excalidraw canvas, Right = AI conversation panel

- [ ] **13.2 — Implement Mermaid→Excalidraw diagram pipeline (Amendment V)**
  - AI generates Mermaid syntax via agent prompt
  - Extension calls `parseMermaidToExcalidraw(mermaidString)` to convert to Excalidraw JSON
  - Load converted JSON into the Excalidraw canvas component
  - User can edit freely (drag, add, delete elements)
  - Save as `.excalidraw` file
  - Add opt-in beta toggle for raw Excalidraw JSON generation: `config.json` → `"diagramBeta": { "rawExcalidraw": true }`

- [ ] **13.3 — Two AI prompt modes for HLD**
  - Socratic (default): guide through questions, don't give solution
  - Solution: generate complete design with Mermaid diagram + written analysis
  - Both configured via `agentPromptDesignHLDSocratic` and `agentPromptDesignHLDSolution` in config

- [ ] **13.4 — Create `LLDView.ts` webview**
  - Same Mermaid→Excalidraw pipeline for class diagrams
  - Layout: Top = diagram canvas, Bottom = code editor area
  - Two AI modes: Socratic (probe SOLID violations) and Solution (complete class hierarchy)

- [ ] **13.5 — AI topic suggestion**
  - When user opens Design Session, quick pick shows: AI Suggested (top), Common Topics list, Custom input
  - AI picks topic based on user's recent practice and weak areas

- [ ] **13.6 — Design problem roadmaps**
  - Create `data/design-roadmap.json` with HLD and LLD problem sets (same schema as study plans)
  - HLD: URL Shortener, Chat System, Rate Limiter, Notification System, File Storage, Social Feed, Search Engine, Video Streaming
  - LLD: Parking Lot, Elevator System, LRU Cache, Snake Game, Tic-Tac-Toe, Online Bookstore, Hotel Booking, Splitwise
  - SRS applies to design problems — rate sessions and schedule reviews

---

## Phase 14: Behavioral Interview Practice 🟡
> Depends on: Phase 0

- [ ] **14.1 — Create `BehavioralView.ts` webview**
  - Story bank stored in `.leetplus/behavioral/stories.json`
  - Schema: `LPBehavioralStory` (id, topic, company, S/T/A/R fields, tags, timestamps, practiceCount)
  - Commands: `LeetPlus: Add Story`, `LeetPlus: Browse Stories`, `LeetPlus: Start Behavioral Mock`

- [ ] **14.2 — AI mock behavioral interview**
  - Pick competency → AI asks behavioral question → user types STAR response in text area → AI evaluates
  - AI evaluates using STAR audit: Situation (10%), Task (10%), Action (60%), Result (20%)
  - Returns structured feedback with scores per component
  - Sessions saved to `.leetplus/behavioral/sessions/`

- [ ] **14.3 — Voice mode placeholder (Amendment C)**
  - Mark as future phase. No implementation now — just a config toggle `"behavioralVoiceMode": false` that does nothing yet
  - Leave a TODO comment in the code for Web Speech API integration

---

## Phase 15: Tablet Whiteboard (HTTP Server) 🟢
> Depends on: Phase 13

- [ ] **15.1 — Build the HTTP server (Amendment M)**
  - Bundle Excalidraw's static build as extension assets
  - On `LeetPlus: Launch Tablet Whiteboard`: start `http.createServer()` on configurable port (default 3001)
  - Serve Excalidraw static files and a save/load REST API for `.excalidraw` files in `.leetplus/designs/`
  - Detect LAN IP via `os.networkInterfaces()`, show notification with URL: "Open on tablet: http://192.168.1.42:3001 [Copy URL]"

- [ ] **15.2 — Stop command**
  - `LeetPlus: Stop Tablet Whiteboard` → kill the HTTP server, show confirmation toast
  - Auto-stop on extension deactivation

---

## Phase 16: Publishing Pipeline 🟡
> Depends on: Phase 0–5

- [ ] **16.1 — Build setup**
  - Create `.vscodeignore` (exclude .ts source, node_modules, test files, docs, .agents/)
- [ ] **16.3 — Marketplace listing (Visual Assets Deferred)**
  - Prepare `package.json` tags (Amendment P).
  - Write text-only description and comparison table.
  - NOTE: Generating screenshots, GIF recording, and logo design is deferred to the final polishing step immediately before actual store submission.

- [ ] **16.4 — Upstream sync setup (Amendment E)**
  - Add two git remotes: `upstream-lcex` → NikkyAmresh/lcex, `upstream-leetcode` → LeetCode-OpenSource/vscode-leetcode
  - Document the sync strategy in CONTRIBUTING.md
  - Note `nicecui/leetcode-debug` for future extension pack research

- [ ] **16.5 — `@leetplus` chat context provider (Amendment K)**
  - Register `vscode.chat.registerChatResourceContextProvider` in activate()
  - Inject: current problem context, snapshot history, daily plan status, pattern mastery, SRS-due count
  - ~50 lines of code

- [ ] **16.6 — Cloud sync hook (Amendment L)**
  - Extend existing `cloud/cloudStatsSync.ts` to sync `state.json`, pattern mastery, guides to Firestore
  - Make sync optional and configurable in config
  - Handle merge conflicts: last-write-wins with timestamp comparison (ISO 8601 UTC)

- [ ] **16.7 — Marketing plan (Amendment D)**
  - (Non-code, for owner only) Prepare materials for: Reddit, HN, Twitter/X, YouTube, Dev.to/Medium, Discord, Product Hunt
  - Prerequisite: website live before marketing push
  - Promote chrome extension as distribution channel

---

## Phase 17: Config Schema Documentation 🟢
> Depends on: All

- [ ] **17.1 — Document full `.leetplus/config.json` schema**
  - Write a comprehensive JSON schema with comments for every field
  - Include all feature toggles, agent prompts, SRS settings, diffLogger, whiteboard, notifications, newsFeed
  - Add `diagramBeta.rawExcalidraw` toggle (Amendment V)
  - Add `behavioralVoiceMode` placeholder (Amendment C)
  - Publish as part of README and as a separate CONFIGURATION.md

---

## Phase 18: LeetCode Button Compatibility 🟢
> Depends on: Phase 0

- [ ] **18.1 — Research official LeetCode extension**
  - Analyze button contributions (CodeLens, editor title, status bar)
  - Analyze authentication flow, problem fetching API, submission API
  - Document findings for compatibility implementation

- [ ] **18.2 — Implement matching buttons**
  - Ensure LeetPlus buttons appear in same locations users expect
  - Handle conflict case: both extensions installed simultaneously

- [ ] **18.3 — Extension pack placeholder**
  - Research `nicecui/leetcode-debug` for integration
  - Create placeholder for `leetplus-pack` marketplace listing

---

## Phase 19: Onboarding Flow 🟢
> Depends on: Phase 1, Phase 10

- [ ] **19.1 — Create `OnboardingView.ts` webview**
  - Trigger on first activation (no `.leetplus/config.json` found)
  - Step 1: Welcome + feature overview
  - Step 2: Goal setting (prep target, date, hours/day, experience level)
  - Step 3: Study plan selection (suggest based on goal, offer AI-generated custom plan)
  - Step 4: Feature toggles (HLD, LLD, Behavioral, Whiteboard, News)
  - Step 5: Preview + apply `.vscode/settings.json` (and other IDE folders per Amendment A)
  - Step 6: Generate config + state files, open Daily Plan sidebar

---

## Phase 20: Tech News & Industry Insights 🟢
> Depends on: Phase 7

- [ ] **20.1 — Implement Source 2 first: AI-fetched on demand**
  - Command: `LeetPlus: Tech News`
  - AI agent prompt (Amendment F): find recent engineering incidents/blog posts, explain system design lessons from a teacher's perspective
  - Focus: "Something broke. Why? How to prevent? What architecture decisions led to failure?"
  - Render in webview with summary cards

- [ ] **20.2 — News webview UI**
  - Featured section (top): 1-2 major incidents with full analysis
  - Feed: scrollable list of summary cards
  - Video: embedded YouTube explanations
  - "For You": AI-personalized based on weak patterns and study focus

- [ ] **20.3 — Source 1: API-driven (later)**
  - Build when website/backend is ready
  - REST API: `GET /api/v1/news?limit=10&category=system-design`
  - Extension fetches and renders in the same webview

- [ ] **20.4 — Source 3: Community contributions (later)**
  - "Contribute" button in News webview → form (Title, Summary, Design Lessons, Source URL, Tags)
  - Submit to API for moderation
  - Initially manual moderation, later AI-assisted

- [ ] **20.5 — Database decision (Amendment U)**
  - Evaluate Firebase vs self-hosted Postgres (Supabase) when building the News API
  - Decision deferred until this phase is in scope

---

## Phase 21: Job Recommendation Engine 🟢
> Depends on: Phase 7, Phase 20

- [ ] **21.1 — Create YC scraper/aggregator service (Backend)**
  - Scrape job postings from Y Combinator (YC) Jobs and Hacker News "Who is Hiring".
  - LLM parser: Extract tech stack, DSA patterns expected, system design difficulty, and experience level.
  - Expose API endpoint: `GET /api/v1/jobs?skills=...&completed=...`

- [ ] **21.2 — Integrate job recommendations in extension**
  - Read `patternMastery` scores and plan completion metrics from user state.
  - Send anonymous skill profile to hosted Job API.
  - Map matching results to a "Jobs" tab in the Tech News webview or Dashboard.
  - Display fit indicators and skill gaps (e.g., "Requires DP; current mastery: 40%").

---

## Phase 22: Miscellaneous & Visualizers 🟢
> Depends on: Phase 1, Phase 19

- [ ] **22.1 — Implement State Visualizer Webview**
  - Command: `LeetPlus: View State Dashboard`
  - Create a custom interactive webview that loads `.leetplus/state.json`.
  - Display user's practice analytics: streaks (current vs best), active study plan name, pattern mastery radar/bar charts, completed vs pending problem ratios, and upcoming SRS review calendars.
  - Present state fields cleanly without making it look like raw JSON, using rich visual representations (e.g. SVG progress bars, calendar grids, lists of upcoming due problems).

- [ ] **22.2 — Fix LeetCode Submit Result Parsing**
  - Update `getSubmitStatus` in `src/modules/LeetCode.ts` to parse `status_code` and `status_msg` from LeetCode check API response.
  - Update `executeCode` in `src/modules/ProblemView.ts` to verify `status.statusCode === 10` or `status.statusMsg === "Accepted"` rather than relying solely on `status.runSuccess === true` (which is true for Wrong Answer).
  - Correct the testcase output UI headings to show `"Wrong Answer"` or other specific error messages instead of falling back to `"SUCCESS"`.

---

## Phase 23: Best Practices Enforcement System 🟢
> Depends on: Phase 4, Phase 10

- [ ] **23.1 — Research and design enforcement workflow**
  - Add configuration setting `practice.forceBestPractices` (boolean, default: `false`).
  - Implement a timer threshold check (e.g. 15 minutes spent on a single problem without active progress).
  - If threshold is exceeded, trigger a notification nudge or automatically spawn a chat conversation with the Socratic agent to discuss the user's current approach, obstacles, and path forward.



