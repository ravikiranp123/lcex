# LeetPlus — Test Gap Analysis

> Systematic audit of what is tested vs what must be tested, organized by feature domain.

---

## Legend
- ✅ Covered — has meaningful assertions
- ⚠️ Partial — exists but has gaps
- ❌ Missing — no test at all

---

## 1. Workspace Initialization (`src/commands/workspace.ts`)

The `leetplus.initializeWorkspace` command is **entirely untested**.

### 1a. Workspace Initialization (Fresh or Idempotent Re-run)
| Scenario | Status | Notes |
|---|---|---|
| Creates `.leetplus/` directory | ❌ | Never tested |
| Creates all 7 subdirs (`snapshots/`, `diffs/`, `guides/`, `designs/`, `behavioral/`, `plans/`, `whiteboard/`) | ❌ | Exact list not verified |
| Creates `config.json` with `{"language": "typescript"}` default | ❌ | Not tested |
| Creates `state.json` via `initState()` | ❌ | Not tested |
| Shows "Workspace successfully initialized for LeetPlus!" notification | ❌ | VS Code notification not tested |

### 1b. Re-initialization (`.leetplus/` already exists)
| Scenario | Status | Notes |
|---|---|---|
| Does NOT overwrite existing `config.json` | ❌ | Not tested |
| Does NOT overwrite existing `state.json` | ❌ | Not tested |
| Creates any missing subdirs only | ❌ | Not tested |
| Edge case: `.leetplus` exists as a *file* (not dir) — deletes and re-creates | ❌ | Not tested |

### 1c. No Workspace Folder Open
| Scenario | Status | Notes |
|---|---|---|
| Shows error "Please open a workspace folder first." | ❌ | Not tested |

### 1d. Error Handling
| Scenario | Status | Notes |
|---|---|---|
| `fs.mkdirSync` throws (permissions) → shows error message | ❌ | Not tested |

---

## 2. Agent Skills Installation (`src/modules/CursorLeetPlusPluginInstall.ts`)

The `ensureCursorLeetPlusPluginInstalled()` function is **entirely untested** despite complex branching.

### 2a. Cursor Plugin (global `~/.cursor/plugins/`)
| Scenario | Status | Notes |
|---|---|---|
| Creates `lp-interview-generator/SKILL.md` when it doesn't exist | ❌ | Not tested |
| Creates `lp-dsa-hint/SKILL.md` when it doesn't exist | ❌ | Not tested |
| Creates `lp-dsa-analyze/SKILL.md` when it doesn't exist | ❌ | Not tested |
| Creates `lp-recap-planner/SKILL.md` when it doesn't exist | ❌ | Not tested |
| Creates `.cursor-plugin/plugin.json` when it doesn't exist | ❌ | Not tested |
| Does NOT re-write files that are already up-to-date (content identical) | ❌ | Not tested |
| Re-writes file when content has changed (`updated` result) | ❌ | Not tested |

### 2b. Antigravity IDE Skills (workspace `/.agents/skills/`)
| Scenario | Status | Notes |
|---|---|---|
| Creates 4 skill SKILL.md files in `.agents/skills/` when absent | ❌ | Not tested |
| Detects content mismatch → shows notification with skill names | ❌ | UI notification not tested |
| Notification can be suppressed via `leetplus.suppressSkillUpdateNotification` config | ❌ | Feature + test both missing |
| User clicks "Overwrite" → overwrites modified files | ❌ | Not tested |
| User clicks "Backup & Overwrite" → creates `.bak` files then overwrites | ❌ | Not tested |
| User clicks "Skip" → no files changed | ❌ | Not tested |
| Backup failure error is logged (but flow continues) | ❌ | Not tested |

### 2c. GitHub Copilot Instructions (`.github/copilot-instructions.md`)
| Scenario | Status | Notes |
|---|---|---|
| Creates `.github/copilot-instructions.md` with merged skill content | ❌ | Not tested |
| Does not re-write if content is identical | ❌ | Not tested |
| Updates when content changes | ❌ | Not tested |

### 2d. No Workspace Folder
| Scenario | Status | Notes |
|---|---|---|
| Skips workspace-level installs when no workspace is open | ❌ | Not tested |

---

## 3. State Manager (`src/modules/StateManager.ts`)

| Scenario | Status | Notes |
|---|---|---|
| `writeState` + `readState` roundtrip | ✅ | Covered |
| `initState` creates file and returns correct schema | ✅ | Covered |
| `readState` returns `null` when file does not exist | ❌ | Not tested |
| `readState` returns `null` for corrupted/invalid JSON | ❌ | Not tested |
| `readState` returns `null` for valid JSON but wrong schema (no `version` or no `problems`) | ❌ | Not tested |
| `writeState` creates `.leetplus/` dir if it doesn't exist | ❌ | Not tested |
| `writeState` uses atomic write (`.tmp` → rename) — verify `.tmp` is cleaned up | ❌ | Not tested |
| `initState` with `planSlug` sets `planSlug` field | ❌ | Not tested |
| `initState` with initial problems list | ❌ | Not tested |
| Written state file has 2-space indentation | ❌ | File format not verified |

---

## 4. SRS Engine (`src/modules/SRSEngine.ts`)

| Scenario | Status | Notes |
|---|---|---|
| All 5 rating levels (0–4) interval calculations | ✅ | Covered |
| `calculateStreaks` — consecutive days | ✅ | Covered |
| `calculateStreaks` — gap in history breaks streak | ⚠️ | Check details |
| `calculatePatternMastery` — success gain formula | ✅ | Covered |
| `calculatePatternMastery` — struggle gain formula | ✅ | Covered |
| `calculatePatternMastery` — failure penalty | ✅ | Covered |
| `calculatePatternMastery` — clamp to [0.0, 1.0] | ⚠️ | Upper clamp tested? |
| `calculatePatternMastery` — clamp below 0.0 | ⚠️ | Lower clamp tested? |
| Rating 2 with level > 4 (uses `REPETITION_INTERVALS[4]`) | ❌ | Boundary not tested |
| Rating 3 level floor at 0 (does not go negative) | ❌ | Not tested |
| `getDueProblems` with mixed past/future dates | ❌ | Not tested |

---

## 5. Snapshot Manager (`src/modules/SnapshotManager.ts`)

| Scenario | Status | Notes |
|---|---|---|
| `captureSnapshot` creates file in `snapshots/` dir | ✅ | Covered |
| Snapshot appended to `completionHistory` | ✅ | Covered |
| `getLatestSnapshot` returns most recent | ⚠️ | Check assertions |
| `captureSnapshot` when problem does not exist in state | ❌ | Not tested |
| `captureSnapshot` with `hintsUsed > 0` | ❌ | Not tested |
| `captureSnapshot` when solution file does not exist | ❌ | Not tested |
| Snapshot filename is ISO-date-based | ❌ | Format not verified |
| Multiple snapshots same day — both saved | ❌ | Not tested |

---

## 6. DiffLogger (`src/modules/DiffLogger.ts`)

| Scenario | Status | Notes |
|---|---|---|
| `smart` mode fires on time threshold | ✅ | Covered |
| `smart` mode fires on char threshold | ✅ | Covered |
| `change` mode fires on char threshold only | ✅ | Covered |
| `time` mode fires on debounce only | ✅ | Covered |
| Diff saved to `.leetplus/diffs/{slug}/{timestamp}.patch` | ❌ | Path format not verified |
| `enabled: false` → listener not registered | ❌ | Not tested |
| Non-tracked file extension → diff not saved | ❌ | Not tested |
| File not matching LeetCode solution pattern → no problem_id | ❌ | Not tested |
| `baseline` updated after diff is saved | ❌ | Not tested |

---

## 7. Editor Settings (`src/modules/LeetPlusEditorSettings.ts`)

Completely untested module.

| Scenario | Status | Notes |
|---|---|---|
| `workspaceHasLeetcodeMarker()` → returns true when `.leetplus` exists | ❌ | Not tested |
| `workspaceHasLeetcodeMarker()` → returns false with no workspace | ❌ | Not tested |
| `suppressTabLikeFeaturesForPracticeLanguage` skips when no marker | ❌ | Not tested |
| `applyLeetPlusEditorFontAndTokenSettingsIfNeeded` skips when `applyWorkspaceFontSettings=false` | ❌ | Not tested |
| Font settings applied when they differ from current | ❌ | Not tested |
| Font settings NOT re-applied when already equal | ❌ | Not tested |
| Italic token rules applied when `editorCursiveItalics=true` | ❌ | Not tested |
| Token rules cleared when `editorCursiveItalics` is turned off | ❌ | Not tested |

---

## 8. Study Plan Switcher (`src/modules/StudyPlanSwitcher.ts`)

| Scenario | Status | Notes |
|---|---|---|
| Switch with all new problems — all set to `pending` | ✅ | Covered |
| Switch with overlapping problems — intersection kept, stats preserved | ✅ | Covered |
| Old-only problems presented for disposition (Keep/Archive/Skip/Remove) | ✅ | Covered |
| New-only problems added as `pending` | ✅ | Covered |
| Archived problems auto-restored when they appear in new plan | ✅ | Covered |
| `today's plan file deleted` to force regeneration | ❌ | File deletion not asserted |
| Local path plan loaded from disk instead of API | ❌ | Not tested |
| API failure during plan fetch | ❌ | Not tested |

---

## 9. Daily Plan Generator (`src/modules/DailyPlanGenerator.ts`)

| Scenario | Status | Notes |
|---|---|---|
| Interleaved mode produces correct ordering | ✅ | Covered |
| Review-first mode order | ✅ | Covered |
| Push mode order | ✅ | Covered |
| Recap mode (reviews only) | ✅ | Covered |
| Weak pattern auto-queue fills empty new slots | ⚠️ | Verify coverage |
| `problemsPerDay` limit is respected | ✅ | Covered |
| Empty state → returns empty plan | ❌ | Not tested |
| All problems mastered (rating=0) → plan behavior | ❌ | Not tested |

---

## 10. Status Bar Manager (`src/modules/StatusBarManager.ts`)

| Scenario | Status | Notes |
|---|---|---|
| `initStatusBar` creates and shows status bar item | ✅ | Covered |
| `updateStatusBar` shows streak and due count | ✅ | Covered |
| `initStatusBar` called twice returns same item (cached) | ⚠️ | Might be tested |
| `updateStatusBar` with `null` state shows default text | ❌ | Not tested |
| `updateStatusBar` with 0 streak, 0 due | ❌ | Not tested |
| Status bar click triggers `leetplus.showDailyPlan` command | ❌ | Not tested |

---

## 11. Config Loading (`src/modules/LeetPlusConfig.ts`)

| Scenario | Status | Notes |
|---|---|---|
| Default values returned for empty config | ✅ | Covered (via ConfigEditor tests) |
| Custom SRS and diffLogger values parsed correctly | ✅ | Covered |
| `inferListSourceForSlug` — slug in studyPlans only | ❌ | Not tested |
| `inferListSourceForSlug` — slug in problemLists only | ❌ | Not tested |
| `inferListSourceForSlug` — slug in both (prefers studyPlan) | ❌ | Not tested |
| `inferListSourceForSlug` — slug in neither (defaults studyPlan) | ❌ | Not tested |
| `reconcileListSource` — stale source corrected | ❌ | Not tested |
| `resolveDefaultStudyPlanSlug` — valid activeStudyPlan returned | ❌ | Not tested |
| `resolveDefaultStudyPlanSlug` — invalid slug falls back to first | ❌ | Not tested |
| `resolveDefaultProblemListSlug` — legacy migration path | ❌ | Not tested |
| `parseStudyPlans` — invalid entries filtered out | ❌ | Not tested |
| `getEffectiveConfig` reads from `.leetplus/config.json` | ❌ | File-based loading not tested |
| `getEffectiveConfig` falls back to VS Code settings when no file | ❌ | Not tested |

---

## 12. Interview Mode (`src/modules/InterviewMode.ts`)

| Scenario | Status | Notes |
|---|---|---|
| Lint checks pass on valid interview session | ✅ | Covered via `interviewLint.test.ts` |
| Lint flags problems solved too quickly | ✅ | Covered |
| Lint flags problems with no solution file | ✅ | Covered |
| `LcInterviewReportStore` saves/loads reports | ❌ | Not tested |
| Interview session timing (tick/stop) | ❌ | Not tested |
| `handleProblemSolved` updates state and mastery | ❌ | Not tested |
| `restoreInterviewOnActivate` restores session from disk | ❌ | Not tested |
| `generateUniqueAttemptHex` produces unique values | ❌ | Not tested |

---

## 13. Template Engine / Java Naming

| Scenario | Status | Notes |
|---|---|---|
| Java file named `LeetPlusMain{N}` by ID | ✅ | Covered |
| Java file named `LeetPlusMain{Slug}` by slug | ✅ | Covered |
| Java file named with suffix | ✅ | Covered |
| `problemKeyFromSolutionFileBase` reverse-maps correctly | ✅ | Covered |
| TypeScript template generation includes header comment | ✅ | Covered (integration test) |
| Python template generation | ❌ | Not tested |
| C++ template generation | ❌ | Not tested |
| Template for problem with no examples | ❌ | Not tested |
| Template for problem with multiple examples | ❌ | Not tested |

---

## 14. Pattern Detector (`src/modules/PatternDetector.ts`)

| Scenario | Status | Notes |
|---|---|---|
| Two Pointers pattern detected | ✅ | Covered |
| Sliding Window detected | ✅ | Covered |
| Dynamic Programming detected | ✅ | Covered |
| File with no known patterns → empty array | ❌ | Not tested |
| Python solution patterns | ❌ | Not tested |
| Java solution patterns | ❌ | Not tested |
| Multiple patterns in same file | ❌ | Not tested |

---

## 15. Heuristic Rater (`src/modules/HeuristicRater.ts`)

Completely untested module.

| Scenario | Status | Notes |
|---|---|---|
| Solution within complexity budget → rating 1 or 2 | ❌ | Not tested |
| Solution exceeds complexity budget → rating 3 or 4 | ❌ | Not tested |
| Hint penalty applied (1-2 hints) | ❌ | Not tested |
| Hint penalty applied (3+ hints, cap at 2) | ❌ | Not tested |
| Returns `{ rating, justification, source: "heuristic" }` | ❌ | Not tested |

---

## 16. Integration Tests

| Scenario | Status | Notes |
|---|---|---|
| Fetch problem 392 from API, generate template, run code | ✅ | Covered |
| Template runs in Python | ❌ | Not tested |
| Template runs in Java | ❌ | Not tested |
| API unreachable → test skips gracefully | ⚠️ | Uses env var but may not skip cleanly |

---

## Summary: Priority Gaps

### P0 — Write immediately (core correctness)
1. **Workspace Initialization** — all 5 scenarios above. This is the user's first action.
2. **Agent Skills Install** — `ensureCursorLeetPlusPluginInstalled` (all 3 IDEs: Cursor, Antigravity, Copilot)
3. **StateManager** — `readState` for null/corrupt/missing, atomic write, schema validation
4. **HeuristicRater** — completely untested fallback path in critical rating flow

### P1 — Write next sprint
5. **DiffLogger** — enabled=false guard, non-tracked files, path format
6. **StudyPlanSwitcher** — plan file deletion, local path loading, API failure
7. **LeetPlusConfig** — `inferListSourceForSlug`, `reconcileListSource`, `getEffectiveConfig` from file
8. **StatusBarManager** — null state, zero counts, command binding

### P2 — Fill in edge cases
9. **SnapshotManager** — missing problem, missing solution file, same-day duplicates
10. **SRSEngine** — level boundary >4, level floor at 0
11. **PatternDetector** — multi-pattern, Python/Java, no matches
12. **EditorSettings** — all paths (requires vscode mock work)
13. **Template Engine** — Python/C++ templates, edge case problem shapes

---

## Test Files to Create

| New Test File | Tests |
|---|---|
| `test/workspaceInit.test.ts` | Workspace initialization (all 5 scenarios) |
| `test/agentSkillsInstall.test.ts` | `CursorLeetPlusPluginInstall` (all 3 IDE targets) |
| `test/heuristicRater.test.ts` | HeuristicRater rating + penalty logic |
| `test/leetPlusConfig.test.ts` | Config resolution helpers (`inferListSourceForSlug`, etc.) |

## Test Files to Expand

| Existing Test File | What to Add |
|---|---|
| `test/stateManager.test.ts` | null/corrupt readState, schema validation, atomic write |
| `test/statusBarManager.test.ts` | null state, zero counts, command click |
| `test/diffLogger.test.ts` | enabled=false, non-tracked extensions, path format |
| `test/snapshotManager.test.ts` | missing problem slug, missing solution file |
| `test/srsEngine.test.ts` | level > 4 boundary, clamp edges |
| `test/studyPlanSwitcher.test.ts` | plan file deletion, local path, API failure |
| `test/pattern-detector.test.ts` | no-match case, multi-pattern, Python/Java |
