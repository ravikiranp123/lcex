# LeetPlus — Comprehensive Implementation Plan: Test Coverage Expansion

## What This Document Is

A complete feature audit and build plan, synthesized from:
1. **Exhaustive analysis of every file in `prep-station`** (13 logic modules, 14 MCP tools, 40+ pattern taxonomy, 3 MCP skills, full data schemas)
2. **2026 market research** (LeetCode extensions, NeetCode, AlgoMonster, Grind 75, SRS tools, AI code review, gamification, anti-cheat patterns)
3. **Full audit of what `lcex` already has** (PatternMastery, PatternDrill, BugReviewStore, Gamification/XP, ProblemTimer, InterviewMode, HintFile, etc.)
4. **Research into System Design, LLD, Behavioral prep, Excalidraw embedding, YouTube in webviews, AI diagram generation, SRS scheduling theory, and publishing pipelines**

---

## Feature Audit: What lcex Already Has

Before adding anything, we need to know what's already built. lcex is far more feature-rich than a typical LeetCode browser:

| Feature | Module | Details |
|---------|--------|---------|
| **Pattern Detection** | `PatternDetector.ts` | 20 patterns detected via regex on solution code. Maps to LeetCode tags. |
| **Pattern Mastery** | `PatternMastery.ts` | Half-life decay scoring (21-day half-life). Tracks solve count, confidence, slugs per pattern. Stored in `globalState`. |
| **Pattern Drills** | `PatternDrill.ts` | "What approach is this?" quizzes. 5-min timer per question. Grades: full/partial/miss. Streak tracking. |
| **Bug Review SRS** | `BugReviewStore.ts` | SRS for failed test cases with intervals `[3, 7, 30, 90]` days. Stores full source at failure time. |
| **XP & Levels** | `Gamification.ts` | XP for: first-solve (10/20/40 by difficulty), daily login (1), focus sessions (10/hr), practice blocks (5/30min). Level formula: `100 * level` XP per level. |
| **Problem Timer** | `ProblemTimer.ts` | Per-problem elapsed timer. Color gradient (green→amber→red→black). Budget by difficulty (15/30/45 min). Per-day breakdown tracking. |
| **Interview Mode** | `InterviewMode.ts` | `.lcInterview` files with planned problems. Timed sessions. Per-problem time tracking. XP breakdown. Report generation (`.lcireport`). Tags (company, plan). |
| **Hint Files** | `HintFile.ts` | Structured `.hint` JSON. Fields: approach (current/suggested/score), efficiency (time/space), code style (readability/structure), coaching (breakdown/thinking/pitfalls/nextFocus). Scores 1-10. |
| **Hint Analysis UI** | `HintAnalysisHtml.ts` | Rich webview rendering of `.hint` files with color-coded ratings. |
| **Inline Decorations** | `InlineDecorations.ts` | Ghost-text feedback on save. |
| **Adversarial Tests** | `AdversarialTests.ts` | Edge case generation. |
| **Fuzzer** | `Fuzzer.ts` | Differential testing (solution vs brute-force). |
| **Empirical Fit** | `EmpiricalFit.ts` | Runtime complexity estimation from actual runs. |
| **Complexity Budget** | `ComplexityBudget.ts` | Expected complexity bounds per problem. |
| **Recursion Visualizer** | `RecursionVisualizer.ts` | Call-tree visualization for recursive solutions. |
| **Iterative Visualizer** | `IterativeVisualizer.ts` | Step-through for iterative solutions. |
| **Constraint Parser** | `ConstraintParser.ts` | Extracts constraints from problem descriptions. |
| **Example Runner** | `ExampleRunner.ts` | Runs examples inline. |
| **Template Engine** | `TemplateEngine.ts` | Multi-language solution templates. |
| **Companies Sidebar** | `CompaniesProvider.ts` | Problems grouped by company with frequency data. |
| **Contests** | `ContestsProvider.ts` | Past contests and upcoming metadata. |
| **Cloud Sync** | `cloud/` | Firebase-backed state sync. |
| **Agent Prompts** | `LeetcodeConfig.ts` | Configurable prompts for hint, analyze, explain, makeRunnable. |
| **Study Plans** | `ProblemsProvider.ts` | Top Interview 150, Blind 75, custom JSON plans via `path`. |
| **Interview Lint** | `InterviewLint.ts` | Real-time feedback during interview mode. |
| **Sandbox** | `Sandbox.ts` | Code execution sandbox. |

---

## What prep-station Adds (Gap Analysis)

| Feature | prep-station Implementation | lcex Equivalent | Gap |
|---------|---------------------------|-----------------|-----|
| **SRS Scheduling** | 5-level intervals `[1, 7, 16, 35, 90]`, level progression, manual 0-4 rating | BugReviewStore has fixed `[3, 7, 30, 90]` but only for failed tests, not problems | **MAJOR** — No problem-level SRS |
| **Daily Plan Generation** | 3 modes (standard/push/recap), priority queues (urgent→normal→pending), category focus | None | **MAJOR** — No daily practice structure |
| **Snapshot History** | Point-in-time solution copies, date-organized archives | None (BugReviewStore stores `fullSource` but only for bugs) | **MAJOR** — No solution progression tracking |
| **Diff Logger** | Watches workspace, saves `.patch` diffs with 10s debounce | None | **HIGH** — Critical for AI trajectory analysis |
| **Rich Content** | Hints, solutions, video links, youtube embeds per problem | NeetCode 150 JSON has this data but no progressive UI | **MEDIUM** — Data exists, UI doesn't present it |
| **Knowledge Guide Library** | JSON notes with tags, weighted fuzzy search (block=3, guide=1, tag=2 scoring) | None | **MEDIUM** — Useful for pattern notes |
| **Activity Heatmap** | DataFrame from completion dates, bar chart | None (ProblemTimer has per-day data) | **MEDIUM** — Data exists, visualization doesn't |
| **Pattern Radar Chart** | Polar chart from pattern_mastery scores | PatternMastery has data, no radar visualization | **MEDIUM** — Data exists, visualization doesn't |
| **Gauntlet Mode** | 3 problems (E/M/H), 45-min blocking timer | InterviewMode already does timed sessions with `.lcInterview` files | **LOW** — Can be an auto-generated `.lcInterview` |
| **Diagnostic Recap** | Special plan after long absence (>7 days) | None | **MEDIUM** — Smart re-entry after break |
| **VS Code Config Management** | Practice settings, keybindings, database-level AI snooze | None | **IMPORTANT** — Clean practice environment |
| **Design Scaffolding** | Creates `.excalidraw` / `.py` template files | None | **MEDIUM** — Useful for HLD/LLD |
| **Behavioral Stories** | STAR method story logging with timestamps | None | **MEDIUM** — Now a full feature |

---

## What the Market is Missing — All Will Be Implemented

| Feature | Why It Matters |
|---------|---------------|
| **AI Auto-Grading** | AI reads the solution + time + hints + diffs and outputs a mastery score automatically. No tool does this. |
| **Trajectory-Aware AI** | Feed snapshot + diff history to the agent. "Your O(n²) from last week became O(n) today." No tool does this. |
| **Hint Penalty Tracking** | Track hints accessed per problem. Factor into mastery scoring. Prevents "hint-then-solve" gaming. |
| **Company-Specific Gauntlet** | Auto-generate `.lcInterview` files using Companies frequency data. "Generate a Meta mock" → top 3 Meta problems. |
| **Weak Pattern Auto-Queue** | SRS + pattern mastery → automatically queue problems for weakest patterns. No manual curation. |
| **Solution Gating** | Lock hints/solutions until you've attempted the problem for X minutes. Prevents "tutorial hell." |

---

## The Build Plan

### Phase 0: Project Rename & Identity

- **Name:** `leet-plus` (package.json `name`)
- **Display Name:** `LeetPlus`
- **Publisher:** Your VS Code marketplace ID
- **Attribution:** Clear hard-fork notice in `README.md`, original MIT `LICENSE` retained.
- **All commands:** Prefix changes from `LeetCode Practice:` to `LeetPlus:`.
- **Config directory:** `.leetplus/` in workspace root — replaces `.leetcode` for ALL LeetPlus-specific config.
- **Data directory:** `.leetplus/` — state, snapshots, diffs, guides, designs, behavioral all live here.
- **Skills renamed:** `lcex-dsa-hint` → `lp-dsa-hint`, `lcex-dsa-analyze` → `lp-dsa-analyze`, etc.

---

### Phase 1: Core Engine — SRS & State

> [!IMPORTANT]
> This is the foundation. Everything else depends on it.

#### [NEW] `StateManager.ts`
- **Schema:** Port prep-station's `State` model to TypeScript interfaces.
- **Location:** Reads/writes `<workspace>/.leetplus/state.json`.
- **Auto-init:** On first activation, if no state file exists, trigger Onboarding (Phase 19).
- **State fields:**
  ```typescript
  interface LPState {
    version: string;               // "1.0"
    planName: string;               // "NeetCode 150"
    startDate: string;              // ISO date
    problems: LPProblem[];          // Full problem list with SRS data
    currentStreak: number;
    bestStreak: number;
    lastActivityDate: string | null;
    patternMastery: Record<string, number>; // Pattern name → 0.0–1.0
    // System Design & Behavioral state
    designProblems: LPDesignProblem[];
    behavioralStories: LPBehavioralStory[];
  }

  interface LPProblem {
    id: number;
    title: string;
    slug: string | null;
    difficulty: string | null;
    category: string;
    status: "pending" | "completed" | "skipped";
    scheduledDate: string;
    nextRepetitionDate: string | null;
    repetitionLevel: number;        // 0–99
    completionHistory: LPSnapshot[];
    patterns: string[];
    // Rich content (from NeetCode 150 JSON)
    leetcodeUrl: string | null;
    youtubeId: string | null;
    solutionLink: { text: string; url: string } | null;
    hints: string[] | null;
    solution: { explanation: string; code: Record<string, string> } | null;
  }

  interface LPSnapshot {
    date: string;
    rating: number;              // 0–4
    notes: string;
    timeSpentSeconds: number;    // From ProblemTimer
    hintsUsed: number;           // Count of hint accesses
    patternsDetected: string[];  // From PatternDetector
    aiRating: number;            // AI's suggested rating
    aiJustification: string;     // AI's reasoning
    diffPatchPaths?: string[];   // Paths to session diff patches (if retention enabled)
  }
  ```

#### [NEW] `SRSEngine.ts`
- Port prep-station's `calculate_next_interval()` exactly:
  - Rating 0 (Mastered): interval=365, level=99
  - Rating 1 (Easy): interval=20, level+1
  - Rating 2 (Good): interval=REPETITION_INTERVALS[min(level, 4)], level+1
  - Rating 3 (Hard): interval=2, level-1 (min 0)
  - Rating 4 (Again): interval=1, level=0
  - **REPETITION_INTERVALS:** `[1, 7, 16, 35, 90]`
- Port `update_streaks()` logic: consecutive-day counting from completion dates.
- Port `update_pattern_mastery()` with diminishing returns:
  - Success: `gain = 0.1 * (1.0 - current)`
  - Struggle: `gain = 0.05 * (1.0 - current)`
  - Failure: `penalty = -0.1` (flat)

#### [NEW] `SnapshotManager.ts`
- On rating submission, copy the current solution file to `.leetplus/snapshots/<problem_id>/<ISO-date>.<ext>`.
- Store metadata in the `LPSnapshot` record within `state.json`.
- Integrate with `ProblemTimer.ts` to capture elapsed seconds.
- Count hint accesses (track via `HintFile.ts` events).
- Run `PatternDetector` on the solution and store detected patterns.

---

### Phase 2: Diff Logger (High Priority)

> [!IMPORTANT]
> Critical for AI trajectory analysis — the AI needs to see HOW code evolves within a single session, not just final snapshots.

#### [NEW] [DiffLogger.ts](file:///Users/ravi/projects/dev/lcex/src/modules/DiffLogger.ts)
- **Event Listener:** Registers `vscode.workspace.onDidChangeTextDocument` listener to capture document changes.
- **Problem Mapping:** Extracts problem context from file path by parsing the filename, looking up the problem in the active `state.json`. If it does not belong to a registered LeetPlus problem, changes are ignored.
- **In-Memory Cache:**
  - `baselineCache`: `Map<string, string>` containing the last committed/saved content for each active file.
  - `debounceTimers`: `Map<string, NodeJS.Timeout>` for debouncing inactivity.
  - `accumulatedChanges`: `Map<string, number>` for tracking total character edits since the last saved diff.
- **Trigger Modes (Configurable in `.leetplus/config.json`):**
  - **time**: Saves diff when the user stops typing for `debounceMs` (default: 10000ms).
  - **change**: Saves diff when the accumulated characters typed/deleted exceeds `charThreshold` (default: 100).
  - **smart** (default): Whichever threshold fires first — time OR change.
- **Diff Generation:**
  - Uses the native local git installation: writes baseline and current text to `.leetplus/tmp/baseline.tmp` and `.leetplus/tmp/current.tmp`, runs `git diff --no-index --patch`, captures the unified diff output, and deletes the temp files.
  - Saves the resulting diff patch to `.leetplus/diffs/<problem_id>/<ISO-timestamp>.patch`.
  - Updates the baseline in the cache to the current text.

## Verification Plan

### Automated Tests
- Create `test/diffLogger.test.ts` to mock `onDidChangeTextDocument` events.
- Test debouncing (time), edit counts (change), and combined limits (smart).
- Assert unified diff files are generated under `.leetplus/diffs/` with correct headers.

### Manual Verification
- Write a manual verification script `test-diff-manual.ts` which simulates typing edits into a tracked file.
- Verify patches are generated in `.leetplus/diffs/<problem_id>/` upon typing or timeout.

---

### Phase 3: Daily Plan Sidebar

#### [NEW] `DailyPlanProvider.ts` (TreeDataProvider)
- Port and improve prep-station's `generate_daily_plan()` logic.
- **Scheduling Strategy — Interleaved (research-backed):**
  Research shows that interleaving reviews with new material produces better retention than reviewing everything first. The default mode interleaves:
  - Build 3 queues: urgent reviews (last rating=4), normal reviews (SRS-due), pending (new problems from plan).
  - **Interleaved mode (default):** Round-robin: 1 urgent review → 1 new → 1 normal review → 1 new → remaining. This prevents "review fatigue" while preserving SRS timing.
  - **Review-first mode:** urgent → normal → pending (maximizes SRS compliance).
  - **Push mode:** urgent → pending → normal (progress-first).
  - **Recap mode:** only reviews, fallback to random completed.
  - Default: 5 problems per day.
- **Weak Pattern Auto-Queue:** The plan generator checks `patternMastery` — if your lowest-scored patterns have unmastered problems available, it prioritizes those in the "New" slots.
- **Tree structure:**
  ```
  📋 Daily Plan (July 10)
  ├── 🔴 Review (3)
  │   ├── 🟡 1. Two Sum (Hard — due today)
  │   ├── 🟡 15. 3Sum (Again — due today)
  │   └── 🟢 121. Best Time to Buy... (Good — due today)
  ├── 🔵 New (2)
  │   ├── 238. Product of Array Except Self
  │   └── 49. Group Anagrams
  └── ✅ Done (1)
      └── 217. Contains Duplicate ✓
  ```
- Clicking a problem → opens `ProblemView` webview (existing behavior).
- Plan auto-generates on workspace activation if today's plan doesn't exist.
- Category focus filter: right-click the plan header → "Focus: Trees only".

#### [NEW] AI-Driven Recap Plan
- If `lastActivityDate` is >7 days ago, the extension invokes the AI agent to generate a personalized comeback plan.
- The AI analyzes:
  - Days since last activity.
  - Pattern mastery scores (what's decayed?).
  - Completion history (what was the user working on before the break?).
  - SRS-overdue queue size.
- The AI generates a study plan JSON (same schema as NeetCode 150, Blind 75) and writes it to `.leetplus/plans/ai-recap-<date>.json`.
- The extension sets this plan as the active plan in `.leetplus/config.json`.
- **New Skill:** `lp-recap-planner` — A dedicated skill with instructions for generating comeback study plans. It outputs valid JSON that the extension can consume directly.
- Show a "Welcome back" notification with the generated plan summary:
  > "Welcome back! It's been 8 days. AI generated a 5-day recap plan focusing on your weakest patterns: Sliding Window, DP. [View Plan]"

---

### Phase 4: AI-First Rating Flow

> [!IMPORTANT]
> Rating is AI-driven by default. The AI analyzes automatically when the user finishes solving; the user reviews and edits the suggested rating.

#### [MODIFY] `ProblemView.ts` — AI-First Rating
- When the user triggers "Complete" (via button or keyboard shortcut), the extension **automatically** runs AI analysis:
  1. Read elapsed time from `ProblemTimer`.
  2. Count hint accesses for this problem.
  3. Read diff patches from current session (from DiffLogger).
  4. Read previous snapshots (if any).
  5. Run `PatternDetector` on the current solution.
  6. Build a structured prompt with all this data and send to the AI agent.
- The AI returns: `{ rating: 0-4, justification: string, patternFeedback: string }`.
- **UI: Rating Review Panel** — A card appears showing:
  - The AI's suggested rating (highlighted, e.g., `🟡 2 — Good`).
  - The AI's justification (1-2 sentences).
  - 5 clickable rating buttons so the user can **override** if they disagree.
  - "Accept" button to confirm the AI's suggestion.
- **Hint Penalty Logic:** The AI factors in hint count: `0 hints = neutral`, `1-2 hints = slight penalty`, `3+ hints = at most rating 2`.
- On confirmation:
  1. Call `SRSEngine.calculateNextInterval()`.
  2. Call `SnapshotManager.captureSnapshot()`.
  3. Update pattern mastery scores.
  4. Update streaks.
  5. Save state.
  6. Move problem to "Done" in Daily Plan.
  7. Show confirmation toast: "Scheduled for review on [date]".
- **Automatic mode toggle:** If the user prefers fully automatic (no review dialog), configurable:
  ```json
  { "autoRating": { "enabled": true, "requireConfirmation": true } }
  ```
  When `requireConfirmation: false`, the AI's rating is accepted silently.

---

### Phase 4.5: Codebase Health — extension.ts Refactoring

At ~4,700 lines, `extension.ts` has become a significant maintenance bottleneck. We will decompose it into logical sub-modules without altering any runtime features or extension behavior.

#### Proposed Modular Architecture
We will extract logic from `extension.ts` into a structured set of commands and editors:

1. **`src/modules/CustomEditors.ts` [NEW]**
   - Register custom document/editor providers:
     - `leetplus.configEditor` (`LeetPlusConfigEditorProvider`)
     - `leetplus.lcInterviewEditor` (`LeetcodeInterviewEditorProvider`)
     - `leetplus.lcInterviewReportEditor` (`LcInterviewReportEditorProvider`)
     - `HintEditorProvider.viewType` (`HintEditorProvider`)
   - Export `registerCustomEditors(context, getProvider)` to keep `activate()` clean.

2. **`src/commands/layout.ts` [NEW]**
   - Register commands dealing with editor view states, sidebar state, focus mode, and problem navigation:
     - `leetplus.focusModeEnter` / `leetplus.focusModeExit`
     - `leetplus.toggleSidebar`
     - `leetplus.nextProblem` / `leetplus.prevProblem`
   - Export `registerLayoutCommands(context)`.

3. **`src/commands/agent.ts` [NEW]**
   - Register AI Socratic coaching, solution implementation analysis, and completion rating commands:
     - `leetplus.agentHint`
     - `leetplus.agentAnalyze`
     - `leetplus.completeProblem`
   - Move evaluation background timers, AI prompt builders, file watch loops, and `applyHintPenaltyToRating` helper to this file.
   - Export `registerAgentCommands(context, getProvider, dailyPlanProvider, refreshAllProblemViews)`.

4. **`src/commands/workspace.ts` [NEW]**
   - Register setup, configuration, and plan-switching operations:
     - `leetplus.initializeWorkspace`
     - `leetplus.switchStudyPlan`
   - Export `registerWorkspaceCommands(context, getProvider)`.

5. **`src/commands/interview.ts` [NEW]**
   - Register interview setup, telemetry, ticks, and reports:
     - `leetplus.interviewModeStart`
     - `leetplus.interviewModeStop`
     - `leetplus.openLcInterviewReportForPath`
     - `leetplus.openLcInterviewReportFile`
     - `leetplus.interviewGenerateWithAi`
   - Move associated helpers: `showInterviewSessionEnded`, `plannedProblemsFromSetup`, `runInterviewSessionAfterPlan`, `startInterviewTick`, `stopInterviewTick`, `refreshInterviewStatusBarNow`, `restoreInterviewOnActivate`, `handleProblemSolved`.
   - Export `registerInterviewCommands(context, getProvider)`.

6. **`src/commands/runner.ts` [NEW]**
   - Register code runners, visualizers, adversarial tests, fuzzers, and complexity estimators:
     - `leetplus.runExamples`
     - `leetplus.measureComplexity`
     - `leetplus.visualizeRecursion`
     - `leetplus.visualizeIterative`
     - `leetplus.fuzzVsBruteForce`
     - `leetplus.complexityBudget`
     - `leetplus.runAdversarialTests`
     - `leetplus.lint`
     - `leetplus.runInTerminal`
     - `leetplus.openNextBugReview`
   - Move inline decorations handlers and helpers.
   - Export `registerRunnerCommands(context)`.

7. **`src/commands/sidebar.ts` [NEW]**
   - Register view searches, filter lists, and tree action helpers:
     - `leetplus.openProblem`
     - `leetplus.openQotd`
     - `leetplus.refreshProblems`
     - `leetplus.refreshContests`
     - `leetplus.refreshCompanies`
     - `leetplus.searchCompanies`
     - `leetplus.filterCompaniesByDifficulty`
     - `leetplus.openContestOnWeb`
     - `leetplus.switchProblemList`
     - `leetplus.refreshQotd`
     - `leetplus.filterByDifficulty`
     - `leetplus.searchProblems`
     - `leetplus.showDailyPlanProblem`
     - `leetplus.switchDailyPlanMode`
     - `leetplus.filterDailyPlanByCategory`
   - Export `registerSidebarCommands(context, getProvider, dailyPlanProvider, refreshAllProblemViews)`.

8. **`src/commands/auth.ts` [NEW]**
   - Register standard authentication, cloud synchronization, stats data view, and stats refreshing commands:
     - `leetplus.signIn`
     - `leetplus.signOut`
     - `leetplus.cloudSignIn`
     - `leetplus.cloudSignOut`
     - `leetplus.setCloudUsername`
     - `leetplus.pushCloudStats`
     - `leetplus.pullCloudStats`
     - `leetplus.viewStats`
     - `leetplus.refreshStatsData`
   - Export `registerAuthCommands(context)`.

9. **`src/commands/misc.ts` [NEW]**
   - Register other configuration helpers:
     - `leetplus.toggleDiffLogger`
     - `leetplus.applyTheme`
     - `leetplus.setDailyGoal`
     - `leetplus.openChatWithPrompt`
   - Export `registerMiscCommands(context)`.

10. **`src/extension.ts` [MODIFY]**
    - Re-exports `activate` and `deactivate`.
    - Simplifies the `activate()` block to sequentially call the registration modules (`registerCustomEditors`, `registerLayoutCommands`, `registerAgentCommands`, `registerWorkspaceCommands`, `registerInterviewCommands`, `registerRunnerCommands`, `registerSidebarCommands`, `registerAuthCommands`, `registerMiscCommands`), dramatically cutting down the size of `extension.ts` to under 300 lines.

---

### Phase 5: AI Trajectory Context

#### Storage Strategy
- **Snapshots (always stored):** Full solution files at each rating event. These are permanent — they show the "before vs after" across sessions.
- **Diffs (configurable retention):**
  - **Default: `"session"` — Keep diffs for the current session only.** When the user rates the problem, diff patches from that session are archived alongside the snapshot (paths stored in `LPSnapshot.diffPatchPaths`). Old session diffs are cleaned up.
  - **`"all"` — Keep all diffs forever.** Useful for deep trajectory analysis but uses more disk space.
  - **`"none"` — Don't store diffs in snapshots.** Diffs are still generated live for real-time AI analysis but discarded after the session.
  ```json
  { "diffRetention": "session" }
  ```

#### [MODIFY] Agent Prompt Templates
- Update `agentPromptHint` and `agentPromptAnalyze` in `.leetplus/config.json` to include:
  ```
  If snapshot history exists at .leetplus/snapshots/{id}/, 
  include previous attempts in reverse chronological order.
  If diff patches exist at .leetplus/diffs/{id}/,
  include the edit progression from the current session.
  ```

#### [MODIFY] Skills (renamed)
- `lp-dsa-hint` — Socratic hint skill. Updated to read snapshots and diffs.
- `lp-dsa-analyze` — Scored review skill. Updated to read snapshots and diffs.
- `lp-recap-planner` — NEW. Generates comeback study plan JSON.
- `lp-auto-rater` — NEW. Returns structured `{ rating, justification, patternFeedback }` JSON.

---

### Phase 6: Content Display

> [!NOTE]
> Simplified from the previous "4-tier gating" approach. Since we use webview (not markdown), rendering is clean. Hints and solutions are simply hidden by default and shown on demand.

#### [MODIFY] `ProblemView.ts` — Rich Content
- **Hints:** Rendered inside collapsible `<details>` blocks. Hidden by default. Click to reveal.
- **Solutions:** Rendered inside collapsible `<details>` blocks with syntax highlighting. Hidden by default.
- **YouTube Videos:** Embedded via `<iframe src="https://www.youtube-nocookie.com/embed/{youtubeId}">` with CSP `frame-src` directive. Hidden inside a collapsible "Video Explanation" section. Falls back to `vscode.env.openExternal()` if embed fails.
- **Solution Gating:** Content is locked until either:
  - User has spent ≥5 minutes on the problem (from ProblemTimer), OR
  - User has made at least 1 submission attempt.
  - Show a lock icon: "Attempt for 5 minutes to unlock hints."
- **Hint tracking:** Every time the user expands a hint `<details>`, increment the `hintsUsed` counter for the current problem. This feeds into AI auto-rating.

---

### Phase 7: Analytics Dashboard

#### [NEW] `DashboardView.ts` (Webview)
- **Command:** `LeetPlus: Show Dashboard`
- **Sections:**

**1. Overview Cards (top row)**
| Card | Source |
|------|--------|
| 🔥 Current Streak | `state.currentStreak` |
| 🏆 Best Streak | `state.bestStreak` |
| ✅ Problems Solved | Count of `status === "completed"` |
| ⏱️ Hours Invested | Sum of all `timeSpentSeconds` / 3600 |
| 📊 Level & XP | From existing `Gamification.ts` |

**2. Activity Heatmap**
- GitHub-style calendar heatmap.
- Data: Aggregate all `completionHistory` dates across all problems.
- Color intensity = problems solved that day.

**3. Pattern Mastery Radar Chart**
- Polar/radar chart showing all patterns from `PatternDetector.ts`.
- Score: Merge prep-station's diminishing-returns mastery with lcex's existing half-life decay.
- Highlight weakest 3 patterns in red.

**4. Difficulty Breakdown**
- Bar chart: Easy/Medium/Hard solved counts.

**5. Time Trend**
- Line chart: Average solve time per week, grouped by difficulty.

**6. SRS Calendar**
- Shows upcoming review dates for the next 30 days.
- "You have 3 reviews due tomorrow, 5 on Friday."

---

### Phase 8: Knowledge Guide Library

#### [NEW] `GuideLibrary.ts`
- Port prep-station's guide system.
- **Storage:** `.leetplus/guides.json`
- **Schema:**
  ```typescript
  interface Guide {
    id: string;           // Auto-increment "g1", "g2"...
    tags: string[];       // ["two-pointers", "edge-case"]
    block: string;        // Category/topic
    guide: string;        // The actual note content
    createdAt: string;    // ISO timestamp
  }
  ```
- **Search:** Weighted fuzzy matching (block=3, content=1, tag=2).
- **Commands:**
  - `LeetPlus: Add Guide` → Input: tags, block, content.
  - `LeetPlus: Search Guides` → Quick pick with fuzzy search.
  - `LeetPlus: List Guides` → Filterable by tag.

#### [NEW] Auto-Guide from AI
- When the AI agent generates a hint or analysis, offer a "Save as Guide" button.
- Extracts the key insight and auto-tags it with the detected patterns.

---

### Phase 9: Gauntlet Mode (Enhanced)

#### [NEW] `GauntletGenerator.ts`
- Generates a `.lcInterview` file dynamically:
  - **Standard Gauntlet:** 1 Easy + 1 Medium + 1 Hard from unmastered problems. 45 minutes.
  - **Company Gauntlet:** Uses `CompaniesData.ts` frequency data. "Generate a Meta mock" → top 3 Meta-frequency problems you haven't mastered.
  - **Weak Pattern Gauntlet:** Picks 3 problems targeting your lowest-scored patterns from PatternMastery.
  - **SRS Gauntlet:** Picks 3 most-overdue SRS review problems.
- Opens the generated `.lcInterview` file in `LcInterviewEditorProvider` (existing Interview Mode infra).
- On completion, writes `.lcireport` (existing) AND updates SRS ratings via AI auto-rating.

#### Commands
- `LeetPlus: Start Gauntlet` → Quick pick: Standard / Company / Weak Patterns / SRS Review
- Company option → second Quick pick listing companies from `CompaniesData.ts`.

---

### Phase 10: Practice Environment Setup

> [!NOTE]
> Renamed from "Anti-Cheat" — the goal is simply a clean practice environment with standard IntelliSense but no AI inline code suggestions.

#### [NEW] `EnvironmentManager.ts`
Port and enhance prep-station's `fix_vscode_config()`.

**`.vscode/settings.json` (written on workspace init):**
```json
{
  "editor.quickSuggestions": {
    "other": "on",
    "comments": "off",
    "strings": "off"
  },
  "editor.suggestOnTriggerCharacters": true,
  "editor.parameterHints.enabled": true,
  "editor.wordBasedSuggestions": "matchingDocuments",
  "editor.suggest.showSnippets": true,
  "editor.suggest.localityBonus": true,

  "github.copilot.enable": { "*": false },
  "editor.inlineSuggest.enabled": false,

  "editor.minimap.enabled": false,
  "editor.renderWhitespace": "selection",
  "breadcrumbs.enabled": false,
  "editor.glyphMargin": false,

  "zenMode.hideStatusBar": false,
  "zenMode.hideActivityBar": false,
  "zenMode.hideTabs": false,

  "errorLens.enabled": true,

  "files.associations": {
    "*.hint": "json"
  }
}
```

**Keybindings (contributed via `package.json`, OS-aware):**

The extension detects `process.platform` and contributes keybindings accordingly:

| macOS | Windows/Linux | Command |
|-------|---------------|---------|
| `Ctrl+L` | `Alt+L` | LeetPlus: Search Problems |
| `Ctrl+Shift+S` | `Alt+S` | LeetPlus: Submit Solution |
| `Ctrl+Shift+T` | `Alt+T` | LeetPlus: Run Tests |
| `Ctrl+Shift+R` | `Alt+R` | LeetPlus: Rate Problem |
| `Ctrl+Shift+H` | `Alt+H` | LeetPlus: Get Hint |
| `Ctrl+D` | `Alt+D` | LeetPlus: Show Dashboard |
| `Ctrl+W` | `Alt+W` | LeetPlus: Open Whiteboard |

> [!NOTE]
> `Alt+` on macOS inserts special characters (e.g., `Alt+S` → `ß`). Using `Ctrl+` or `Ctrl+Shift+` avoids this. The extension sets the correct bindings based on `os.platform()` at activation time.

---

### Phase 11: Notifications & Reminders

#### [NEW] `NotificationManager.ts`
- **On activation:** If there are SRS-due problems, show VS Code info notification:
  > "🔴 You have 3 problems due for review today. [Open Daily Plan]"
- **After long absence (>7 days):** Show welcome-back notification:
  > "Welcome back! It's been 8 days. AI is generating a personalized recap plan... [View Plan]"
- **After completing daily plan:** Show celebration:
  > "🎉 Daily plan complete! Streak: 12 days. [Show Dashboard]"
- Uses `vscode.window.showInformationMessage()` with action buttons — no external dependencies.

---

### Phase 12: Pattern Taxonomy Merge

#### [MODIFY] `PatternDetector.ts`
- **Current:** 20 patterns detected via regex.
- **Enhancement:** Merge prep-station's expanded taxonomy (~40 patterns across 9 categories) into the detection system.
- **New patterns to add:** Kadane's Algorithm, Cyclic Sort, Dutch National Flag, Fast & Slow Pointers, Monotonic Queue, Morris Traversal, Segment Tree, Bitmask DP, Digit DP, Bidirectional Search, Dijkstra's, Prim's/Kruskal's, Grid Paths, Knapsack variants, N-Queens pattern, LCS.
- Each new pattern gets a regex signature and maps to the radar chart.

---

### Phase 13: System Design — HLD & LLD Practice

> [!IMPORTANT]
> Expands LeetPlus beyond pure coding. Toggled via `.leetplus/config.json`. All diagram generation uses Excalidraw JSON — no Mermaid.

#### [NEW] `DesignView.ts` (Webview) — HLD Practice

**Embedded Excalidraw:**
- Bundle `@excalidraw/excalidraw` npm package into the webview.
- Use `vscode.postMessage` bridge for save/load.
- Files saved to `.leetplus/designs/<topic>.excalidraw`.
- This is the **extension-level Excalidraw** — for desktop diagramming.

**AI-Generated Diagrams (Excalidraw Only):**
- When the user describes a system, the AI generates **Excalidraw JSON** directly.
- Research confirms LLMs can generate valid Excalidraw JSON using the `ExcalidrawElementSkeleton` format (type, x, y, width, height, text, containerId, startBinding/endBinding for arrows).
- Alternatively, the AI can generate Mermaid syntax internally and the extension uses `@excalidraw/mermaid-to-excalidraw` to convert it to Excalidraw JSON before rendering — giving the visual quality of Excalidraw with the reliability of Mermaid generation. This is an implementation detail invisible to the user.
- The generated diagram loads directly into the embedded Excalidraw canvas. User can edit it freely.

**Two AI Prompt Modes for HLD:**

1. **Socratic Mode (default)** — The AI guides the user toward a solution through questions:
   ```
   agentPromptDesignHLDSocratic: "Act as a senior system design interviewer. 
   Ask clarifying questions about requirements. Challenge the user's decisions. 
   Probe trade-offs (CAP theorem, consistency vs availability). 
   Do NOT give the complete solution. Ask one question at a time. 
   When the user has a reasonable design, generate an Excalidraw JSON diagram of their architecture."
   ```

2. **Solution Mode** — The AI generates a full solution:
   ```
   agentPromptDesignHLDSolution: "Generate a complete system design for '{topic}'. 
   Output: 1) Excalidraw JSON diagram of the architecture. 
   2) Components, responsibilities, and data flow. 
   3) Scaling trade-offs and bottlenecks."
   ```

**AI Topic Suggestion:**
- When the user opens `LeetPlus: Start Design Session`, the quick pick shows:
  - **AI Suggested** (top): The AI picks a topic based on the user's recent practice, weak areas, or what they haven't tried yet.
  - **Common Topics:** URL Shortener, Chat System, Rate Limiter, Notification System, etc.
  - **Custom:** User enters their own prompt.

**HLD Practice Workflow:**
1. `LeetPlus: Start Design Session` → Pick a topic (AI-suggested, preset, or custom).
2. A webview opens with:
   - **Left:** The embedded Excalidraw canvas (starts blank or with AI-generated diagram).
   - **Right:** AI conversation panel (Socratic by default — asks questions, challenges decisions).
3. On completion, the session is saved to `.leetplus/designs/` with the Excalidraw file and a markdown summary.

#### [NEW] `LLDView.ts` (Webview) — Low-Level Design Practice

**AI-Generated Class Diagrams (Excalidraw):**
- The AI generates class diagrams as Excalidraw JSON (boxes with text for classes, arrows for relationships).
- User can edit the diagram, add classes, etc.

**Two AI Prompt Modes for LLD:**

1. **Socratic Mode (default):**
   ```
   agentPromptDesignLLDSocratic: "Act as a senior interviewer for a machine coding round.
   Ask the user to identify core entities. Challenge their class structure. 
   Probe SOLID violations. Ask about design patterns. 
   Do NOT give the complete class hierarchy. Guide through questions."
   ```

2. **Solution Mode:**
   ```
   agentPromptDesignLLDSolution: "Generate a low-level design for '{topic}'.
   Output: 1) Excalidraw JSON class diagram. 2) Design patterns applied.
   3) Key method signatures. 4) SOLID principle adherence."
   ```

**LLD Practice Workflow:**
1. `LeetPlus: Start LLD Session` → Pick a topic (AI-suggested, preset, or custom).
2. A webview opens with:
   - **Top:** Rendered Excalidraw class diagram.
   - **Bottom:** Code editor area for implementation.
3. The AI reviews the implementation for SOLID violations, missing edge cases, and design pattern misuse.

#### [NEW] Design Problem Roadmaps
- Curated sets of common HLD/LLD problems:
  - **HLD:** URL Shortener, Chat System, Rate Limiter, Notification System, File Storage, Social Feed, Search Engine, Video Streaming.
  - **LLD:** Parking Lot, Elevator System, LRU Cache, Snake Game, Tic-Tac-Toe, Online Bookstore, Hotel Booking, Splitwise.
- Stored in `data/design-roadmap.json` with the same schema as study plans.
- SRS applies to design problems too — rate your sessions and get them scheduled for review.

---

### Phase 14: Behavioral Interview Practice

> [!IMPORTANT]
> Behavioral rounds are make-or-break for senior roles. STAR method practice in the IDE.

#### [NEW] `BehavioralView.ts` (Webview)

**Story Bank:**
- `.leetplus/behavioral/stories.json` stores STAR-format stories:
  ```typescript
  interface LPBehavioralStory {
    id: string;
    topic: string;              // "Leadership", "Conflict", "Failure", "Initiative"
    company?: string;           // Optional: target company
    situation: string;          // 10% of response
    task: string;               // 10% of response
    action: string;             // 60% of response
    result: string;             // 20% of response — must be quantified
    tags: string[];             // ["leadership", "cross-functional", "data-driven"]
    createdAt: string;
    lastPracticedAt?: string;
    practiceCount: number;
  }
  ```

**AI Mock Behavioral Interview:**
- `LeetPlus: Start Behavioral Mock` → Pick a competency (Leadership, Conflict, Failure, Initiative, Teamwork).
- The AI acts as an interviewer:
  1. Asks a behavioral question ("Tell me about a time you disagreed with your manager").
  2. The user types their STAR response in a text area.
  3. The AI evaluates using the STAR audit framework:
     - **Situation:** Is it specific enough? (10%)
     - **Task:** Is your role clear? (10%)
     - **Action:** Are you using "I" not "we"? Are steps detailed? (60%)
     - **Result:** Is it quantified? ("Reduced latency by 40%") (20%)
  4. Returns structured feedback with scores per STAR component.
- Sessions saved to `.leetplus/behavioral/sessions/`.

**Commands:**
- `LeetPlus: Add Story` → Structured input for S/T/A/R fields.
- `LeetPlus: Browse Stories` → Searchable/filterable story bank.
- `LeetPlus: Start Behavioral Mock` → AI-driven mock session.

---

### Phase 15: Whiteboard (Unified Docker)

> [!NOTE]
> The tablet Excalidraw experience is a single, self-contained Docker setup. The extension generates and manages the compose file. Teleport server is merged into this.

#### Unified Docker Whiteboard
- The extension ships a built-in `docker-compose.yaml` template (stored in extension assets).
- `LeetPlus: Launch Tablet Whiteboard` command:
  1. Writes the compose file to `.leetplus/whiteboard/docker-compose.yaml` (if not already present).
  2. Runs `docker-compose up -d`.
  3. Detects the local network IP (`os.networkInterfaces()`).
  4. Shows a notification with the LAN URL:
     > "Whiteboard running! Open on your tablet: http://192.168.1.42:3001 [Copy URL]"
- The compose file includes:
  - **Excalidraw UI** on port 3001.
  - **File API** (teleport server merged in) on port 5000 — handles save/load of `.excalidraw` files to/from the workspace `.leetplus/designs/` directory.
- `LeetPlus: Stop Tablet Whiteboard` → Runs `docker-compose down`.

**Configurable in `.leetplus/config.json`:**
```json
{
  "whiteboard": {
    "enabled": true,
    "port": 3001,
    "designsDir": ".leetplus/designs"
  }
}
```

---

### Phase 16: Publishing Pipeline

> [!IMPORTANT]
> Higher priority than news and onboarding. Gets the extension into users' hands.

#### Publishing Setup
- **`.vscodeignore`:** Exclude `.ts` source, `node_modules`, test files, docs.
- **Bundling:** Use `esbuild` to minify into `dist/extension.js` for fast startup.
- **`package.json` scripts:**
  ```json
  {
    "vscode:prepublish": "npm run build",
    "package": "vsce package",
    "publish": "vsce publish"
  }
  ```

#### CI/CD Pipeline (GitHub Actions)
```yaml
name: Publish LeetPlus
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npx vsce publish -p ${{ secrets.VSCE_TOKEN }}
```

#### Marketplace Listing
- **Icon:** Custom LeetPlus logo (no SVGs — marketplace rejects them).
- **README:** Feature screenshots, GIFs of key workflows, comparison table vs competitors.
- **Categories:** `["Other", "Education"]`
- **Tags:** `["leetcode", "interview", "spaced-repetition", "system-design", "behavioral"]`

#### Upstream Sync Strategy
- Track `LeetCode-OpenSource/vscode-leetcode` as `upstream` remote.
- Periodically `git fetch upstream` and merge relevant bug fixes.
- Document divergence points in `CHANGELOG.md`.

---

### Phase 17: Full `.leetplus/config.json` Schema

All features are configurable through `.leetplus/config.json` (replaces `.leetcode`):

```json
{
  // === Core Identity ===
  "language": "python",
  "theme": "leetcode-dark",
  "fileNamePattern": "id",

  // === Study Plans ===
  "studyPlans": [
    { "slug": "top-interview-150", "name": "Top Interview 150" },
    { "slug": "neetcode-150", "name": "NeetCode 150", "path": "data/neetcode-150.json" }
  ],
  "activeStudyPlan": "neetcode-150",

  // === SRS & Daily Plan ===
  "srs": {
    "enabled": true,
    "intervals": [1, 7, 16, 35, 90],
    "problemsPerDay": 5,
    "defaultMode": "interleaved"
  },

  // === Diff Logger ===
  "diffLogger": {
    "enabled": true,
    "triggerMode": "smart",
    "debounceMs": 10000,
    "charThreshold": 100,
    "trackedExtensions": [".py", ".ts", ".js", ".cpp", ".java", ".go"]
  },

  // === AI & Rating ===
  "autoRating": {
    "enabled": true,
    "requireConfirmation": true
  },
  "diffRetention": "session",

  // === Agent Prompts ===
  "agentPromptHint": "Load **lp-dsa-hint** and follow it...",
  "agentPromptAnalyze": "Load **lp-dsa-analyze** and follow it...",
  "agentPromptAutoRate": "Analyze this solution and rate mastery 0-4...",
  "agentPromptDesignHLDSocratic": "Act as a senior system design interviewer...",
  "agentPromptDesignHLDSolution": "Generate a complete system design...",
  "agentPromptDesignLLDSocratic": "Act as a senior LLD interviewer...",
  "agentPromptDesignLLDSolution": "Generate a low-level design...",
  "agentPromptBehavioral": "Act as a FAANG interviewer. Evaluate STAR...",

  // === Features Toggle ===
  "hldEnabled": true,
  "lldEnabled": true,
  "behavioralEnabled": true,

  // === Whiteboard ===
  "whiteboard": {
    "enabled": true,
    "port": 3001,
    "designsDir": ".leetplus/designs"
  },

  // === Font & Editor ===
  "applyWorkspaceFontSettings": true,
  "editorFontFamily": "Fira Code iScript",
  "editorCursiveItalics": true,

  // === Notifications ===
  "notifications": {
    "onActivation": true,
    "onPlanComplete": true,
    "welcomeBack": true
  },

  // === News Feed ===
  "newsFeed": {
    "enabled": false,
    "source": "api",
    "apiUrl": ""
  }
}
```

---

### Phase 18: LeetCode Official Plugin Compatibility (Low Priority)

> [!NOTE]
> Analyze how the official LeetCode extension's buttons work (Submit, Run, etc.) and implement compatibility or replacement.

- Research the official LeetCode VS Code extension's:
  - Button contributions (CodeLens? Editor title buttons? Status bar?)
  - Authentication flow (cookie-based login)
  - Problem fetching API
  - Submission API
- Implement matching button positions and behaviors in LeetPlus.
- Ensure LeetPlus buttons appear in the same locations users expect from the official extension.
- Handle the case where both extensions are installed — avoid conflicts.

---

### Phase 19: Onboarding Flow (Low Priority)

> [!NOTE]
> First-time user experience. Runs when no `.leetplus/` directory exists.

#### [NEW] `OnboardingView.ts` (Webview)
- Triggered on first activation (no `.leetplus/config.json` found).
- **Step 1 — Welcome:** Explain what LeetPlus is, feature overview with screenshots.
- **Step 2 — Goal Setting:**
  - "What are you preparing for?" → Quick pick: FAANG Interview / Startup / General DSA / System Design / All
  - "When is your target date?" → Date picker (affects daily problem count).
  - "How many hours per day?" → Slider (1-4 hours).
  - "Experience level?" → Beginner / Intermediate / Advanced.
- **Step 3 — Study Plan:**
  - Based on goal and experience, suggest a study plan (NeetCode 150, Blind 75, custom).
  - Option: "Let AI generate a personalized plan" → Uses the `lp-recap-planner` skill to create a custom plan based on goal, timeline, and experience.
- **Step 4 — Feature Toggle:**
  - Checkboxes for optional features: HLD Practice, LLD Practice, Behavioral, Whiteboard, News Feed.
- **Step 5 — Environment Setup:**
  - Preview the `.vscode/settings.json` that will be written.
  - Explain: "This disables AI code suggestions for honest practice."
  - "Apply" button.
- **Step 6 — Ready!**
  - Generates `.leetplus/config.json` with all selected options.
  - Creates `.leetplus/state.json` with the selected study plan.
  - Opens the Daily Plan sidebar.

---

### Phase 20: Tech News & Industry Insights (Low Priority)

> [!IMPORTANT]
> This is a unique differentiator — no interview prep tool combines tech news with practice. System design interviews frequently reference real-world incidents (Cloudflare outages, AWS failures, architectural decisions at scale).

#### Architecture: Dual-Source System

**Source 1: API-Driven (Generic, Same for All Users)**
- You maintain a separate website/service that runs a background task to:
  1. Aggregate engineering blog posts (Cloudflare, AWS, Google, Netflix, Uber, etc.).
  2. Use AI to summarize incidents and extract system design lessons.
  3. Serve via a REST API: `GET /api/v1/news?limit=10&category=system-design`.
- The extension fetches from this API and renders in a "News" webview tab.
- **Schema:**
  ```typescript
  interface NewsItem {
    id: string;
    title: string;           // "Why Cloudflare went down for 3 hours"
    summary: string;         // AI-generated 2-3 paragraph summary
    designLessons: string[]; // ["Single point of failure", "Cascading failures"]
    category: string;        // "Outage", "Architecture", "Scaling", "Security"
    sourceUrl: string;       // Original blog post
    youtubeId?: string;      // Related video explanation
    publishedAt: string;
    tags: string[];          // ["cdn", "dns", "failover"]
  }
  ```

**Source 2: AI-Fetched (Personalized)**
- The extension asks the AI agent to find recent tech news relevant to the user's current practice areas.
- Example: User is practicing Graph problems → AI finds "How LinkedIn rebuilt their graph database" articles.
- Uses a dedicated prompt:
  ```json
  { "agentPromptNews": "Find 3 recent engineering blog posts or incidents relevant to these topics: {userTopics}. For each, provide: title, 2-paragraph summary, system design lessons, and source URL." }
  ```

**Source 3: Community Contributions**
- Users can submit their own researched news items via the API.
- Submission flow:
  1. User clicks "Contribute" in the News webview.
  2. A form appears: Title, Summary, Design Lessons, Source URL, Tags.
  3. Submitted to the API for moderation.
  4. Approved items appear in the global feed for all users.
- **Moderation:** Initially manual (you review submissions). Later, AI-assisted moderation.

#### News Webview

- **Command:** `LeetPlus: Tech News`
- **Sections:**
  - **Featured** (top): 1-2 major recent incidents with full analysis.
  - **Feed:** Scrollable list of recent items with summary cards.
  - **Video:** Embedded YouTube explanations (using the same iframe approach as problem videos).
  - **For You:** AI-personalized recommendations based on the user's weak patterns and study focus.

#### Market Opportunity

- **No competitor does this.** LeetCode, NeetCode, AlgoMonster — none integrate real-world engineering news.
- System design interviews at FAANG companies frequently ask "How would you prevent the Cloudflare outage?" — candidates with current knowledge stand out.
- Community contributions create a network effect — users who contribute become invested in the platform.
- The API service can be monetized independently (newsletter, premium tier with deeper analysis).

---

## What We Kill / Keep Separate

| Feature | Decision | Reason |
|---------|----------|--------|
| CLI (`station` command) | **Kill** | Extension replaces everything |
| Streamlit Dashboard | **Kill** | Replaced by DashboardView webview |
| Docker Excalidraw + Teleport | **Unified** | Single Docker compose, managed by extension. Phase 15. |
| Diff Logger | **Port** | Reimplemented as native `FileSystemWatcher` — Phase 2 |
| MCP Server | **Keep running** | AI agents can still call tools. Extension reads same `state.json`. |
| Google Calendar | **Kill** | Out of scope, adds OAuth complexity |
| Anki | **Kill** | Replaced by Guide Library + SRS |
| Behavioral Stories | **Ported** | Full feature in Phase 14 |
| `aliases.zsh` | **Kill** | All commands are VS Code commands now |
| Git auto-commit | **Kill** | VS Code has built-in source control |

---

## Verification Plan

### Automated Tests
- Unit tests for `SRSEngine.ts` — validate interval calculations match prep-station's Python output exactly.
- Unit tests for `StateManager.ts` — read/write/migration.
- Unit tests for pattern mastery scoring — verify diminishing returns math.
- Unit tests for `DiffLogger.ts` — verify smart trigger (debounce + char threshold), diff generation, file output.

### Manual Verification
- Full session walkthrough: activate → daily plan → solve → AI auto-rates → verify snapshot + diff created → verify SRS date updated → verify pattern mastery changed.
- Dashboard renders correctly with real data.
- Gauntlet generates valid `.lcInterview` files and opens Interview Mode.
- Content gating locks/unlocks correctly based on time spent.
- YouTube embeds play in the webview.
- Practice environment settings are written correctly.
- HLD session: AI generates Excalidraw JSON → renders in webview → user can edit.
- LLD session: AI generates class diagram → renders in webview → user implements code.
- Behavioral mock: AI asks question → user responds → AI evaluates STAR structure.
- Diff patches are generated on smart trigger and AI can read them.
- Onboarding flow generates valid `.leetplus/config.json`.
- News feed renders items from API and AI sources.

---

## Amendments (July 10)

### Amendment A: Multi-IDE Settings (Phase 10)
The practice environment settings must be written to ALL supported IDE config folders, not just `.vscode/`:
- `.vscode/settings.json` — VS Code
- `.cursor/settings.json` — Cursor
- `.antigravity/settings.json` — Antigravity IDE (if applicable)
The `EnvironmentManager.ts` detects which IDEs are in use (by checking for existing config folders or `process.env`) and writes to all relevant folders. A single canonical settings object is maintained — written identically to each folder.

### Amendment B: Dashboard Priority Lowered (Phase 7)
Phase 7 (Analytics Dashboard) is lowered from 🟡 Medium to 🟢 Low priority. Core SRS/rating/plan features take precedence. Dashboard is a "nice to have" that can ship later.

### Amendment C: Behavioral Voice Mode (Phase 14, Future)
Future consideration: Add a voice mode to the Behavioral Mock Interview:
- Use the Web Speech API (`SpeechRecognition` + `SpeechSynthesis`) in the webview.
- AI reads the question aloud via TTS. User responds verbally via microphone. Speech-to-text captures the response.
- Simulates a real phone/video screen more closely.
- This is a **later phase** enhancement — text-based mock comes first.

### Amendment D: Marketing (Phase 16)
After publishing, execute a marketing push (non-code, for owner only):
- **Reddit:** Post to r/leetcode, r/cscareerquestions, r/vscode, r/programming with demo GIFs.
- **Hacker News:** Show HN post with a focus on the SRS + AI trajectory analysis angle (novel, not just another LeetCode browser).
- **Twitter/X:** Thread showing the workflow: solve → AI rates → SRS schedules → trajectory-aware hints.
- **YouTube:** Short demo video (~3 min) showing the full loop.
- **Dev.to / Medium:** Technical blog post on building an SRS-based interview prep system.
- **Discord:** Post in LeetCode, NeetCode, and competitive programming Discord servers.
- **Product Hunt:** Launch after first stable release with at least 50 users.
- **Prerequisite:** Website must be connected and live before marketing push. The website serves as landing page, hosts the News API, and builds credibility.

### Amendment E: Dual Upstream Repos (Phase 16)
Track TWO upstream repositories:
1. **`NikkyAmresh/lcex`** — The direct parent fork. This is the primary upstream for the extension code, features, and architecture.
2. **`LeetCode-OpenSource/vscode-leetcode`** — The original LeetCode extension. Track for API compatibility, authentication changes, and button/command patterns.
Additionally, look into `nicecui/leetcode-debug` (VS Code LeetCode debugging extension) — useful debugging features that could be integrated. This is a placeholder for future research; we may publish an **extension pack** on the marketplace later that bundles LeetPlus + leetcode-debug as a recommended set.

### Amendment F: News AI Focus — System Design Incidents (Phase 20)
The AI-fetched personalized news (Source 2) should NOT be restricted to the user's current pattern (e.g., "you're doing graphs → here's a graph article"). The primary focus is **real-world system design incidents from a teacher's perspective:**
- Something broke in production. Why did it break?
- What system design decisions led to the failure?
- What architecture was used? What were the trade-offs?
- How could it have been prevented? What would the fix look like at scale?
- Example: "Cloudflare went down for 3 hours because of a BGP misconfiguration cascading through their edge network. Design lesson: Single points of failure in DNS/routing, importance of canary deployments, circuit breaker patterns."
- The AI acts as a **teacher**, not a search engine — it explains the engineering lessons, not just summarizes the event.
- This is what differentiates us: turning news into interview prep material.

### Amendment I: Offline Fallback — `HeuristicRater.ts` (Phase 4)
When AI is unavailable (no network, provider down, rate-limited), auto-rating should NOT go silent. Build a `HeuristicRater.ts` (~80 lines) that glues three existing modules:
- `ComplexityBudget.ts` — if solution exceeds expected complexity for the problem, auto-lower rating.
- `ConstraintParser.ts` — extract constraints from problem description (e.g., n ≤ 10⁵). If solution appears O(n²) for that constraint, flag it.
- `EmpiricalFit.ts` — run the solution on sample inputs, measure real runtime, estimate complexity class.
- `PatternDetector.ts` — auto-detect which patterns the solution uses (already exists).
The AI path is preferred. HeuristicRater is the fallback. The rating pipeline tries AI first → falls back to heuristic if AI times out (5s) or errors.

### Amendment J: Staged Rating Pipeline (Phase 4)
The "Complete" action must feel instant to the user. Stage it:
1. **Immediate (0ms):** Save snapshot + update `state.json` locally. No network.
2. **Debounced (2s later):** Trigger AI auto-rating in background.
3. **UI:** Rating review panel opens optimistically with a skeleton/loading state while AI computes.
4. **If AI fails:** Fall back to `HeuristicRater.ts` and show the heuristic estimate.
This ensures the user is never blocked waiting for AI latency.

### Amendment K: `@leetplus` Chat Context Provider (Phase 16)
Register a `vscode.chat.registerChatResourceContextProvider` so users can type `@leetplus` in any VS Code, Cursor, or Windsurf AI chat to inject:
- Current problem context (title, difficulty, constraints)
- Snapshot history for the active problem
- Today's daily plan status
- Pattern mastery scores
- SRS-due problems count
This is ~50 lines of code and dramatically improves the AI coding assistant workflow. Ship before marketplace publishing.

### Amendment L: Cloud Sync Scope (Phase 16)
Extend existing Firebase infra (`cloud/firebaseApp.ts`, `cloud/cloudStatsSync.ts`) to sync:
- `state.json` (SRS data, streaks, problem status)
- Pattern mastery scores
- Guides
- Behavioral stories
Cross-device SRS continuity is a genuine moat — no competitor offers this. Cloud sync is optional and configured via `.leetplus/config.json`.

### Amendment M: Whiteboard — HTTP Server Only (Phase 15)
Drop Docker entirely for now. Use a built-in Node.js HTTP server instead:
- The extension bundles Excalidraw's static build as assets.
- On `LeetPlus: Launch Tablet Whiteboard`, start a Node.js `http.createServer()` that serves the Excalidraw static files and a small save/load API for `.excalidraw` files in `.leetplus/designs/`.
- Detect LAN IP via `os.networkInterfaces()`, show notification with tablet URL.
- On `LeetPlus: Stop Tablet Whiteboard`, kill the server.
- Lighter than Docker (no Docker Desktop required), simpler to implement, easier for users.
- Docker-based approach deferred indefinitely — can be added later if isolation or advanced use cases demand it.

### Amendment N: Kill/Keep Table Expansion
Additional items for the What We Kill / Keep table:

| Feature | Decision | Reason |
|---------|----------|--------|
| Recursion/Iterative Visualizers | **Keep + extend** | Already exist in lcex. Integrate into Phase 12.5 visualization system. |
| Cloud Sync (Firebase) | **Keep + extend** | Already exists. Add SRS state sync. Cross-device moat (Phase 16). |
| ComplexityBudget / EmpiricalFit / ConstraintParser | **Keep + extend** | Already exist. Use as offline AI fallback for auto-rating (Phase 4). |
| Chrome Extension (open-in-editor) | **Keep + promote** | Already exists in `chrome-extension/`. Distribution channel — market it (Phase 16). |

### Amendment O: Daily Plan Mode Switcher (Phase 3)
The session mode (interleaved/review-first/push/recap) should be switchable on-demand from the sidebar header — not just via `config.json`. Add a dropdown/quick-pick in the TreeView header. Clicking "recap" should directly generate the plan without asking for confirmation — friction kills study habits.

### Amendment P: Expanded Marketplace SEO Tags (Phase 16)
Tags in `package.json` should cover every search term:
```json
["leetcode", "interview prep", "spaced repetition", "system design", "dsa", "coding interview",
 "neetcode", "blind 75", "top interview 150", "SRS", "mock interview", "behavioral interview",
 "algorithm", "data structures", "FAANG", "practice", "study plan"]
```
Also promote the existing `chrome-extension/` directory in the marketplace README as a distribution channel.

### Amendment Q: Status Bar Feedback (Phase 1)
As a zero-cost visual feedback mechanism, add a status bar item that ships with Phase 1:
- Shows: `🔥 12 | 📋 3 due` (streak count + problems due for review today)
- Clicking it opens the Daily Plan sidebar.
- This provides immediate visual feedback even before the Dashboard (Phase 7) is built.

### Amendment R: Open-Source Strategy & BYO-Key (Phase 16, Reference)
Strategic notes from DeepSeek discussion (for future reference, not immediate implementation):
- **Open-source the extension under MIT.** Public repo builds trust. Case studies: GitLens (MIT, acquired), vscode-leetcode (MIT, 2M+ installs).
- **Open-core model:** Free client, Pro features are server-side (cloud sync, managed AI credits, curated news feed).
- **Bring-Your-Own-Key (BYO-Key):** Users who supply their own OpenAI/Anthropic/Gemini API key get AI features without any subscription. The Pro subscription removes API key management friction.
- **Self-hosting option:** Users can point to their own Firebase/Supabase project. Prevents backlash.
- **All paid features come later** — initial release is 100% free. Pro tier introduced after user base is established.

### Amendment S: Rating Confidence Indicator (Phase 4)
The rating review panel should show the source of the rating:
- `🤖 AI Rating` — when AI auto-rating succeeds
- `📊 Heuristic Estimate` — when offline fallback is used
- `👤 Manual` — when user rates without AI
This transparency builds user trust in the auto-rating system.

### Amendment T: ISO 8601 UTC Timestamps (Phase 1)
All timestamps in `state.json`, snapshots, diffs, and guides must use ISO 8601 UTC format (e.g., `2026-07-10T13:30:00Z`). This simplifies cloud sync conflict resolution and avoids timezone bugs across devices.

### Amendment U: Database Strategy Deferred (Phase 20)
Build Phase 1–15 with Firebase (already implemented in lcex, zero additional work). When the News API is needed (Phase 20), evaluate whether to:
1. Keep Firebase + add a separate Postgres-based News API alongside it, OR
2. Migrate to self-hosted Postgres via Supabase (provides: Postgres DB, REST API, real-time subscriptions, auth, storage).
Decision deferred until Phase 20 is in scope.

### Amendment V: Diagram Pipeline — Mermaid→Excalidraw (Phase 13)
Replace the direct LLM→Excalidraw JSON approach. The confirmed pipeline is:
1. **AI generates Mermaid syntax** (flowcharts, sequence diagrams, class diagrams) — LLMs are highly reliable at producing valid Mermaid.
2. **Extension converts** Mermaid → Excalidraw JSON using `@excalidraw/mermaid-to-excalidraw` (official npm package from the Excalidraw team). This runs locally, no network needed.
3. **Excalidraw canvas renders** the converted JSON in the webview — user gets a fully editable, drag-and-drop diagram.
4. **Saved as `.excalidraw`** file.
The user never sees the Mermaid intermediate format. They get the best of both: reliable AI generation + beautiful, editable Excalidraw output.
**Raw Excalidraw JSON generation** (AI directly produces element coordinates) is available as **opt-in beta** via `config.json`: `"diagramBeta": { "rawExcalidraw": true }`. This is less reliable but gives more precise AI control for advanced users.

### Amendment W: Monetization Framework (Future Reference)
From DeepSeek discussion — pricing and tier structure for future implementation:

**Always Free (Core Loop):**
- SRS engine, daily plan, interleaved scheduling, manual rating
- Snapshot history, local pattern detection, dashboard
- Gauntlet generation, guide library, practice environment
- All bundled algorithm visualizations, onboarding flow
- Offline heuristic auto-rating
- BYO-Key for all AI features

**Paid Tier — "LeetPlus Pro" (Future):**
1. **Cloud Sync** — Syncs state, SRS, patterns, guides across machines. Free alt: user provides own Firebase project.
2. **Managed AI Credits** — Auto-rating, trajectory analysis, recap plans. Free tier: 50 AI completions/month. Pro: unlimited. Also works with BYO-Key (no subscription).
3. **Curated Tech News Feed** — Hosted API with AI-curated system design incidents. Free tier: 5 fetches/day. Pro: full archive + digest.

**Pricing (tentative, to be refined post-launch):**
- Pro Monthly: $5/month
- Pro Annual: $40/year
- Lifetime Pro: $120 one-time (early supporter window)
- AI Credit Top-Up: $5 for 500 extra completions

**Implementation:** Runtime feature flags (`isProEnabled`) checked against a lightweight license server (Lemon Squeezy, Paddle, or Firebase-validated subscription). All Pro gates compiled in source but inactive without valid key. Repo remains fully buildable for self-hosters.

### Amendment X: Job Recommendation Engine (Phase 21, Low Priority)
Implement a hosted service that aggregates and analyzes job requirements from sources like Y Combinator (YC) Jobs, Hacker News "Who is Hiring", and major tech boards:
- **Scraper Service:** Runs on the backend to scrape job descriptions, tech stacks, and experience requirements.
- **Skill Mapping:** Uses LLM to parse and extract the core DSA patterns, system design expectations, and languages required for each job.
- **Personalized Recommendations:** The extension sends the user's localized `patternMastery` scores and plan completion percentage (anonymized) to the backend. The backend replies with matching jobs where the user's skills align best, highlighting "skill gaps" (e.g., "This job requires Graphs/Distributed Systems; your Graph mastery is 85%").
- **UI:** A "Jobs" tab in the dashboard/news webview displaying recommended postings with fit scores.

---

## Proposed Execution Order

| Phase | Description | Priority | Depends On |
|-------|-------------|----------|------------|
| **0** | Rename to `leet-plus`, `.leetplus/` everywhere, skill renames | 🔴 High | Nothing |
| **1** | `StateManager.ts`, `SRSEngine.ts`, `SnapshotManager.ts` + status bar | 🔴 High | Phase 0 |
| **2** | `DiffLogger.ts` (smart triggers, opt-in, default enabled) | 🔴 High | Phase 0 |
| **3** | `DailyPlanProvider.ts` + interleaved scheduling + mode switcher + AI recap | 🔴 High | Phase 1 |
| **4** | AI-first rating + `HeuristicRater.ts` fallback + staged pipeline + confidence flag | 🔴 High | Phase 1, 2 |
| **4.5** | `extension.ts` Refactoring & modularization | 🔴 High | Phase 4 |
| **5** | AI trajectory context (skills, prompts, diff integration) | 🔴 High | Phase 1, 2 |
| **6** | Content display (hints, solutions, YouTube embed, gating) | 🟡 Medium | Phase 4 |
| **7** | `DashboardView.ts` analytics webview | 🟢 Low | Phase 1 |
| **8** | `GuideLibrary.ts` | 🟡 Medium | Phase 1 |
| **9** | `GauntletGenerator.ts` (enhanced) | 🟡 Medium | Phase 1 |
| **10** | `EnvironmentManager.ts` practice environment (multi-IDE) | 🟡 Medium | Phase 0 |
| **11** | `NotificationManager.ts` | 🟡 Medium | Phase 1, 3 |
| **12** | Pattern taxonomy merge | 🟡 Medium | Phase 1 |
| **13** | `DesignView.ts` LLD/HLD + Mermaid→Excalidraw pipeline | 🟡 Medium | Phase 0 |
| **14** | `BehavioralView.ts` + STAR bank + AI mock (text-first, voice later) | 🟡 Medium | Phase 0 |
| **15** | Tablet whiteboard (built-in HTTP server, no Docker) | 🟢 Low | Phase 13 |
| **16** | Publishing + `@leetplus` context provider + cloud sync + marketing + dual upstream | 🟡 Medium | Phase 0–5 |
| **17** | Full `.leetplus/config.json` documentation | 🟢 Low | All |
| **18** | LeetCode button compatibility + extension pack placeholder | 🟢 Low | Phase 0 |
| **19** | Onboarding flow | 🟢 Low | Phase 1, 10 |
| **20** | Tech News (system design incident focus) + Community | 🟢 Low | Phase 7 |
| **21** | Job Recommendation Engine (YC jobs aggregation & skill fit) | 🟢 Low | Phase 7, 20 |
| **22** | State Visualizer Dashboard Webview & Submit Result Parsing | 🟢 Low | Phase 1, 19 |
| **23** | Best Practices Enforcement System (Nudge/discuss approach) | 🟢 Low | Phase 4, 10 |

### Amendment Y: Best Practices Enforcement System (Phase 23, Low Priority)
Provides a configuration option `practice.forceBestPractices` (boolean, default: `false`) to help users adhere to effective interview preparation behaviors:
- **Timer Threshold:** Tracks active problem-solving time using `ProblemTimer`. If the user spends more than 15 minutes on a single problem without making substantial progress or passing test cases, it triggers an intervention.
- **Intervention Flow:** Displays a non-intrusive VS Code notification nudge or automatically initiates a Socratic AI chat thread to discuss the user's current approach, obstacles, and guide them dynamically without revealing the solution.
