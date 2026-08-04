import * as vscode from "vscode";
import { isSupportedLanguage, type SupportedLanguage } from "./interface/Problem";
import { LANGUAGE_CHOICES } from "./language/LanguageStrategy";
import type { LeetPlusConfig } from "./LeetPlusConfig";

const DEFAULTS: LeetPlusConfig = {
  studyPlans: [{ slug: "top-interview-150", name: "Top Interview 150" }],
  problemLists: [],
  activeStudyPlan: undefined,
  activeProblemList: undefined,
  theme: "auto",
  defaultDirectory: ".",
  fileNamePattern: "id",
  language: "typescript",
  internalApiUrl: "",
  showProblemset: true,
  showStudyPlans: true,
  showProblemLists: true,
  showQotd: true,
  qotdMonths: 6,
  problemViewMode: "ui",
  srs: {
    enabled: true,
    intervals: [1, 7, 16, 35, 90],
    problemsPerDay: 5,
    defaultMode: "interleaved"
  },
  diffLogger: {
    enabled: true,
    triggerMode: "smart",
    debounceMs: 10000,
    charThreshold: 100,
    trackedExtensions: [".py", ".ts", ".js", ".cpp", ".java", ".go"]
  },
  autoRating: {
    enabled: true,
    requireConfirmation: true
  },
  diffRetention: "session",
};

export function parseConfig(text: string): LeetPlusConfig {
  const trimmed = text.trim();
  if (!trimmed) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const config: LeetPlusConfig = { ...DEFAULTS };
    if (Array.isArray(parsed.studyPlans)) {
      config.studyPlans = parsed.studyPlans.filter(
        (p: unknown): p is { slug: string; name: string; path?: string } =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as { slug?: unknown }).slug === "string" &&
          typeof (p as { name?: unknown }).name === "string"
      ).map((p) => ({
        slug: (p as { slug: string }).slug,
        name: (p as { name: string }).name,
        ...(typeof (p as { path?: unknown }).path === "string" && (p as { path: string }).path.trim()
          ? { path: (p as { path: string }).path.trim() }
          : {}),
      }));
      if (config.studyPlans.length === 0) config.studyPlans = DEFAULTS.studyPlans;
    }
    if (Array.isArray(parsed.problemLists)) {
      config.problemLists = parsed.problemLists.filter(
        (p: unknown): p is { slug: string; name: string } =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as { slug?: unknown }).slug === "string" &&
          typeof (p as { name?: unknown }).name === "string"
      );
    }
    if (typeof parsed.activeStudyPlan === "string") config.activeStudyPlan = parsed.activeStudyPlan;
    if (typeof parsed.activeProblemList === "string") config.activeProblemList = parsed.activeProblemList;
    if (parsed.activeListSource === "studyPlan" || parsed.activeListSource === "problemList") {
      config.activeListSource = parsed.activeListSource;
    }
    if (["auto", "leetcode-dark", "none"].includes(String(parsed.theme))) {
      config.theme = parsed.theme as LeetPlusConfig["theme"];
    }
    if (typeof parsed.defaultDirectory === "string") config.defaultDirectory = parsed.defaultDirectory;
    if (["id", "slug", "id.slug"].includes(String(parsed.fileNamePattern))) {
      config.fileNamePattern = parsed.fileNamePattern as "id" | "slug" | "id.slug";
    }
    if (parsed.language !== undefined && isSupportedLanguage(String(parsed.language))) {
      config.language = parsed.language as SupportedLanguage;
    }
    if (typeof parsed.showProblemset === "boolean") config.showProblemset = parsed.showProblemset;
    if (typeof parsed.showStudyPlans === "boolean") config.showStudyPlans = parsed.showStudyPlans;
    if (typeof parsed.showProblemLists === "boolean") config.showProblemLists = parsed.showProblemLists;
    if (typeof parsed.showQotd === "boolean") config.showQotd = parsed.showQotd;
    if (typeof parsed.qotdMonths === "number" && parsed.qotdMonths >= 1) config.qotdMonths = parsed.qotdMonths;
    if (typeof parsed.internalApiUrl === "string") config.internalApiUrl = parsed.internalApiUrl;
    if (typeof parsed.agentPromptMakeRunnable === "string") config.agentPromptMakeRunnable = parsed.agentPromptMakeRunnable;
    if (typeof parsed.agentPromptHint === "string") config.agentPromptHint = parsed.agentPromptHint;
    if (typeof parsed.agentPromptAnalyze === "string") config.agentPromptAnalyze = parsed.agentPromptAnalyze;
    if (typeof parsed.agentPromptExplain === "string") config.agentPromptExplain = parsed.agentPromptExplain;
    if (parsed.problemViewMode === "ui" || parsed.problemViewMode === "text") {
      config.problemViewMode = parsed.problemViewMode;
    }
    
    // Parse srs
    if (parsed.srs && typeof parsed.srs === "object") {
      const s = parsed.srs as any;
      config.srs = {
        enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULTS.srs!.enabled,
        problemsPerDay: typeof s.problemsPerDay === "number" ? s.problemsPerDay : DEFAULTS.srs!.problemsPerDay,
        defaultMode: ["interleaved", "review-first", "push", "recap"].includes(s.defaultMode) ? s.defaultMode : DEFAULTS.srs!.defaultMode,
        intervals: Array.isArray(s.intervals) ? s.intervals.map(Number) : DEFAULTS.srs!.intervals
      };
    } else {
      config.srs = DEFAULTS.srs;
    }

    // Parse diffLogger
    if (parsed.diffLogger && typeof parsed.diffLogger === "object") {
      const dl = parsed.diffLogger as any;
      config.diffLogger = {
        enabled: typeof dl.enabled === "boolean" ? dl.enabled : DEFAULTS.diffLogger!.enabled,
        triggerMode: ["smart", "time", "change"].includes(dl.triggerMode) ? dl.triggerMode : DEFAULTS.diffLogger!.triggerMode,
        debounceMs: typeof dl.debounceMs === "number" ? dl.debounceMs : DEFAULTS.diffLogger!.debounceMs,
        charThreshold: typeof dl.charThreshold === "number" ? dl.charThreshold : DEFAULTS.diffLogger!.charThreshold,
        trackedExtensions: Array.isArray(dl.trackedExtensions) ? dl.trackedExtensions.map(String) : DEFAULTS.diffLogger!.trackedExtensions
      };
    } else {
      config.diffLogger = DEFAULTS.diffLogger;
    }

    // Parse autoRating
    if (parsed.autoRating && typeof parsed.autoRating === "object") {
      const ar = parsed.autoRating as any;
      config.autoRating = {
        enabled: typeof ar.enabled === "boolean" ? ar.enabled : DEFAULTS.autoRating!.enabled,
        requireConfirmation: typeof ar.requireConfirmation === "boolean" ? ar.requireConfirmation : DEFAULTS.autoRating!.requireConfirmation
      };
    } else {
      config.autoRating = DEFAULTS.autoRating;
    }

    // Parse diffRetention
    if (["session", "all", "none"].includes(String(parsed.diffRetention))) {
      config.diffRetention = parsed.diffRetention as LeetPlusConfig["diffRetention"];
    } else {
      config.diffRetention = DEFAULTS.diffRetention;
    }

    return config;
  } catch {
    return { ...DEFAULTS };
  }
}

export function configToJson(config: LeetPlusConfig): string {
  return JSON.stringify(config, null, 2);
}

function getWebviewContent(config: LeetPlusConfig, webview: vscode.Webview): string {
  const studyPlans = config.studyPlans ?? DEFAULTS.studyPlans!;
  const plansHtml = studyPlans
    .map(
      (p, i) => {
        const hasLocal = Boolean(p.path?.trim());
        const badge = hasLocal
          ? `<span class="source-badge local" title="Problems loaded from local file">📁 Local file</span>`
          : `<span class="source-badge api" title="Problems fetched from LeetCode API">🌐 LeetCode API</span>`;
        return `
      <div class="plan-row" data-index="${i}">
        <div class="plan-row-top">
          <input type="text" class="plan-slug" value="${escapeHtml(p.slug)}" placeholder="e.g. neetcode-150" title="Slug" />
          <input type="text" class="plan-name" value="${escapeHtml(p.name)}" placeholder="Display name" title="Display name" />
          <button class="btn-remove" data-index="${i}" title="Remove">×</button>
        </div>
        <div class="plan-row-path">
          <input type="text" class="plan-path" value="${escapeHtml(p.path ?? "")}" placeholder="Optional: .leetplus/data/neetcode-150.json (relative to workspace)" title="Local data file path" />
          <button type="button" class="btn-browse" data-index="${i}" title="Browse local JSON file">Browse...</button>
          ${badge}
        </div>
      </div>`;
      }
    )
    .join("");
  const problemLists = config.problemLists ?? [];
  const problemListsHtml = problemLists
    .map(
      (p, i) => `
      <div class="list-row" data-index="${i}">
        <input type="text" class="list-slug" value="${escapeHtml(p.slug)}" placeholder="e.g. graph" />
        <input type="text" class="list-name" value="${escapeHtml(p.name)}" placeholder="Display name" />
        <button class="btn-remove" data-index="${i}" title="Remove">×</button>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeetCode Config</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h2 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2::before {
      content: '';
      width: 4px;
      height: 16px;
      background: #FFA116;
      border-radius: 2px;
    }
    .section {
      margin-bottom: 24px;
    }
    .section:last-child { margin-bottom: 0; }
    .field {
      margin-bottom: 12px;
    }
    .field label {
      display: block;
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    select, input[type="text"], input[type="number"] {
      width: 100%;
      padding: 8px 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 13px;
    }
    select:focus, input:focus {
      outline: none;
      border-color: #FFA116;
    }
    .plan-row, .list-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
      padding: 10px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
    }
    .plan-row-top {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      align-items: center;
    }
    .plan-row-top input, .list-row input { margin: 0; }
    .plan-row-path {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .plan-row-path input {
      flex: 1;
      font-size: 12px;
      padding: 6px 10px;
    }
    .btn-browse {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      border: 1px solid var(--vscode-widget-border);
      padding: 4px 8px;
      font-size: 11px;
      border-radius: 4px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .btn-browse:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .source-badge {
      flex-shrink: 0;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .source-badge.local {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .source-badge.api {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .list-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      padding: 0;
      border: none;
      border-radius: 0;
      margin-bottom: 8px;
      align-items: center;
    }
    .list-row input { margin: 0; }
    .btn-remove {
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--vscode-input-border);
      color: var(--vscode-foreground);
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-remove:hover {
      background: var(--vscode-button-hoverBackground, #333);
      border-color: #FFA116;
      color: #FFA116;
    }
    .btn-add {
      padding: 8px 16px;
      background: #FFA116;
      color: #1A1A1A;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      margin-top: 4px;
    }
    .btn-add:hover { background: #FFB84D; }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-row label { margin: 0; }
  </style>
</head>
<body>
  <div class="section">
    <h2>Study Plans</h2>
    <div id="plans-container">${plansHtml}</div>
    <button class="btn-add" id="add-plan">+ Add Study Plan</button>
    <div class="field">
      <label>Default study plan (Study Plans sidebar)</label>
      <select id="activeStudyPlan">
        <option value="">First in list</option>
        ${studyPlans.map((p) => `<option value="${escapeHtml(p.slug)}" ${config.activeStudyPlan === p.slug ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  </div>
  <div class="section">
    <h2>Problem lists</h2>
    <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin: 0 0 12px 0;">LeetCode problem-list slugs (URL <code>/problem-list/&lt;slug&gt;/</code>, e.g. <code>graph</code>). Shown in the Problem Lists sidebar.</p>
    <div id="problem-lists-container">${problemListsHtml}</div>
    <button class="btn-add" id="add-problem-list">+ Add Problem List</button>
    <div class="field">
      <label>Default problem list (Problem Lists sidebar)</label>
      <select id="activeProblemList">
        <option value="">First in list</option>
        ${problemLists.map((p) => `<option value="${escapeHtml(p.slug)}" ${config.activeProblemList === p.slug ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  </div>
  <div class="section">
    <h2>Appearance</h2>
    <div class="field">
      <label>Theme</label>
      <select id="theme">
        <option value="auto" ${config.theme === "auto" ? "selected" : ""}>Auto (LeetCode Dark when .leetcode exists)</option>
        <option value="leetcode-dark" ${config.theme === "leetcode-dark" ? "selected" : ""}>Always LeetCode Dark</option>
        <option value="none" ${config.theme === "none" ? "selected" : ""}>None (don't change theme)</option>
      </select>
    </div>
  </div>
  <div class="section">
    <h2>API</h2>
    <div class="field">
      <label>Internal API URL (optional)</label>
      <input type="text" id="internalApiUrl" value="${escapeHtml(config.internalApiUrl ?? "")}" placeholder="https://internal-api.example.com" />
    </div>
  </div>
  <div class="section">
    <h2>Files & Language</h2>
    <div class="field">
      <label>Default directory for new problems</label>
      <input type="text" id="defaultDirectory" value="${escapeHtml(config.defaultDirectory ?? ".")}" placeholder="." />
    </div>
    <div class="field">
      <label>File name pattern</label>
      <select id="fileNamePattern">
        <option value="id" ${config.fileNamePattern === "id" ? "selected" : ""}>ID (e.g. 167.ts)</option>
        <option value="slug" ${config.fileNamePattern === "slug" ? "selected" : ""}>Slug (e.g. two-sum.ts)</option>
        <option value="id.slug" ${config.fileNamePattern === "id.slug" ? "selected" : ""}>ID.Slug (e.g. 167.two-sum.ts)</option>
      </select>
    </div>
    <div class="field">
      <label>Language</label>
      <select id="language">
        ${LANGUAGE_CHOICES.map(
          ({ id, label }) =>
            `<option value="${id}" ${config.language === id ? "selected" : ""}>${escapeHtml(label)}</option>`
        ).join("\n        ")}
      </select>
    </div>
  </div>
  <div class="section">
    <h2>Agent prompts (solution file toolbar)</h2>
    <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin: 0 0 12px 0;">When a solution file (.ts, .js, .py, .cpp, .java) is open in a LeetCode workspace, toolbar buttons open Cursor chat with these prompts. Edit in .leetcode to customize.</p>
    <div class="field">
      <label>Make runnable button</label>
      <input type="text" id="agentPromptMakeRunnable" value="${escapeHtml(config.agentPromptMakeRunnable ?? "Make this Runnable, do not give solution.")}" placeholder="Make this Runnable, do not give solution." />
    </div>
    <div class="field">
      <label>Hint button (coaching)</label>
      <input type="text" id="agentPromptHint" value="${escapeHtml(config.agentPromptHint ?? "Load **lp-dsa-hint** and follow it. Nudge from the problem only—do not read or review my code. Each `coaching` value: one short line; no solution.")}" placeholder="lp-dsa-hint; problem-only; no code review; one line per field." />
    </div>
    <div class="field">
      <label>Analyze button (scored review)</label>
      <input type="text" id="agentPromptAnalyze" value="${escapeHtml(config.agentPromptAnalyze ?? "Load **lp-dsa-analyze** and follow it. Analyze my current LeetCode solution implementation.")}" placeholder="Load lp-dsa-analyze; fills Analysis in .hint JSON." />
    </div>
    <div class="field">
      <label>Explain selection (base prompt)</label>
      <input type="text" id="agentPromptExplain" value="${escapeHtml(config.agentPromptExplain ?? "")}" placeholder="Explain my code: intuition, dry run, complexity…" style="width:100%;" />
    </div>
  </div>
  <div class="section">
    <h2>Views</h2>
    <div class="field">
      <label>Open problem from sidebar (Problemset / Study plans / Lists / QOTD)</label>
      <select id="problemViewMode">
        <option value="ui" ${(config.problemViewMode ?? "ui") === "ui" ? "selected" : ""}>UI — webview (run, submit, notes)</option>
        <option value="text" ${config.problemViewMode === "text" ? "selected" : ""}>Plain text — statement only (editor tab)</option>
      </select>
    </div>
    <div class="toggle-row">
      <label>Show Problemset view</label>
      <input type="checkbox" id="showProblemset" ${config.showProblemset !== false ? "checked" : ""} />
    </div>
    <div class="toggle-row">
      <label>Show Study Plans view</label>
      <input type="checkbox" id="showStudyPlans" ${config.showStudyPlans !== false ? "checked" : ""} />
    </div>
    <div class="toggle-row">
      <label>Show Problem Lists sidebar</label>
      <input type="checkbox" id="showProblemLists" ${config.showProblemLists !== false ? "checked" : ""} />
    </div>
    <div class="toggle-row">
      <label>Show Question of the Day</label>
      <input type="checkbox" id="showQotd" ${config.showQotd !== false ? "checked" : ""} />
    </div>
    <div class="field">
      <label>QOTD cache (months)</label>
      <input type="number" id="qotdMonths" value="${config.qotdMonths ?? 6}" min="1" max="24" />
    </div>
  </div>
  <div class="section">
    <h2>Spaced Repetition (SRS)</h2>
    <div class="toggle-row">
      <label>Enable Spaced Repetition (SRS)</label>
      <input type="checkbox" id="srsEnabled" ${config.srs?.enabled !== false ? "checked" : ""} />
    </div>
    <div class="field">
      <label>Problems per day</label>
      <input type="number" id="srsProblemsPerDay" value="${config.srs?.problemsPerDay ?? 5}" min="1" max="50" />
    </div>
    <div class="field">
      <label>Default scheduling mode</label>
      <select id="srsDefaultMode">
        <option value="interleaved" ${(config.srs?.defaultMode ?? "interleaved") === "interleaved" ? "selected" : ""}>Interleaved (reviews & new mixed)</option>
        <option value="review-first" ${config.srs?.defaultMode === "review-first" ? "selected" : ""}>Review-first (maximize SRS)</option>
        <option value="push" ${config.srs?.defaultMode === "push" ? "selected" : ""}>Push (progress-first)</option>
        <option value="recap" ${config.srs?.defaultMode === "recap" ? "selected" : ""}>Recap (only reviews)</option>
      </select>
    </div>
    <div class="field">
      <label>Repetition intervals (days, comma separated)</label>
      <input type="text" id="srsIntervals" value="${(config.srs?.intervals ?? [1, 7, 16, 35, 90]).join(",")}" placeholder="1,7,16,35,90" />
    </div>
  </div>
  <div class="section">
    <h2>Diff Logger</h2>
    <div class="toggle-row">
      <label>Enable Diff Logger</label>
      <input type="checkbox" id="diffLoggerEnabled" ${config.diffLogger?.enabled !== false ? "checked" : ""} />
    </div>
    <div class="field">
      <label>Trigger mode</label>
      <select id="diffLoggerTriggerMode">
        <option value="smart" ${(config.diffLogger?.triggerMode ?? "smart") === "smart" ? "selected" : ""}>Smart (Time OR Change)</option>
        <option value="time" ${config.diffLogger?.triggerMode === "time" ? "selected" : ""}>Time-based (Inactivity)</option>
        <option value="change" ${config.diffLogger?.triggerMode === "change" ? "selected" : ""}>Change-based (Char count)</option>
      </select>
    </div>
    <div class="field">
      <label>Debounce timer (milliseconds)</label>
      <input type="number" id="diffLoggerDebounceMs" value="${config.diffLogger?.debounceMs ?? 10000}" min="1000" />
    </div>
    <div class="field">
      <label>Character change threshold</label>
      <input type="number" id="diffLoggerCharThreshold" value="${config.diffLogger?.charThreshold ?? 100}" min="1" />
    </div>
    <div class="field">
      <label>Tracked extensions (comma separated)</label>
      <input type="text" id="diffLoggerTrackedExtensions" value="${(config.diffLogger?.trackedExtensions ?? [".py", ".ts", ".js", ".cpp", ".java", ".go"]).join(",")}" placeholder=".py,.ts,.js,.cpp,.java,.go" />
    </div>
  </div>
  <div class="section">
    <h2>AI & Auto Rating</h2>
    <div class="toggle-row">
      <label>Enable AI Auto-Rating</label>
      <input type="checkbox" id="autoRatingEnabled" ${config.autoRating?.enabled !== false ? "checked" : ""} />
    </div>
    <div class="toggle-row">
      <label>Require confirmation (Review Dialog)</label>
      <input type="checkbox" id="autoRatingRequireConfirmation" ${config.autoRating?.requireConfirmation !== false ? "checked" : ""} />
    </div>
    <div class="field">
      <label>Diff patch retention</label>
      <select id="diffRetention">
        <option value="session" ${(config.diffRetention ?? "session") === "session" ? "selected" : ""}>Session (clean up after solve)</option>
        <option value="all" ${config.diffRetention === "all" ? "selected" : ""}>All (keep all patches forever)</option>
        <option value="none" ${config.diffRetention === "none" ? "selected" : ""}>None (discard patches after submit)</option>
      </select>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function escapeHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function collectConfig() {
      const plans = [];
      document.querySelectorAll('.plan-row').forEach(row => {
        const slug = row.querySelector('.plan-slug')?.value?.trim() || '';
        const name = row.querySelector('.plan-name')?.value?.trim() || '';
        const pathVal = row.querySelector('.plan-path')?.value?.trim() || '';
        if (slug && name) {
          const entry = { slug, name };
          if (pathVal) entry.path = pathVal;
          plans.push(entry);
        }
      });
      if (plans.length === 0) plans.push({ slug: 'top-interview-150', name: 'Top Interview 150' });
      const problemLists = [];
      document.querySelectorAll('.list-row').forEach(row => {
        const slug = row.querySelector('.list-slug')?.value?.trim() || '';
        const name = row.querySelector('.list-name')?.value?.trim() || '';
        if (slug && name) problemLists.push({ slug, name });
      });
      return {
        studyPlans: plans,
        problemLists,
        activeStudyPlan: document.getElementById('activeStudyPlan')?.value?.trim() || undefined,
        activeProblemList: document.getElementById('activeProblemList')?.value?.trim() || undefined,
        theme: document.getElementById('theme').value,
        defaultDirectory: document.getElementById('defaultDirectory').value.trim() || '.',
        fileNamePattern: document.getElementById('fileNamePattern').value,
        language: document.getElementById('language').value,
        internalApiUrl: document.getElementById('internalApiUrl').value.trim(),
        showProblemset: document.getElementById('showProblemset').checked,
        showStudyPlans: document.getElementById('showStudyPlans').checked,
        showProblemLists: document.getElementById('showProblemLists').checked,
        showQotd: document.getElementById('showQotd').checked,
        qotdMonths: Math.max(1, parseInt(document.getElementById('qotdMonths').value, 10) || 6),
        agentPromptMakeRunnable: document.getElementById('agentPromptMakeRunnable').value.trim() || undefined,
        agentPromptHint: document.getElementById('agentPromptHint').value.trim() || undefined,
        agentPromptAnalyze: document.getElementById('agentPromptAnalyze').value.trim() || undefined,
        agentPromptExplain: document.getElementById('agentPromptExplain').value.trim() || undefined,
        problemViewMode: document.getElementById('problemViewMode').value === 'text' ? 'text' : 'ui',
        srs: {
          enabled: document.getElementById('srsEnabled').checked,
          problemsPerDay: Math.max(1, parseInt(document.getElementById('srsProblemsPerDay').value, 10) || 5),
          defaultMode: document.getElementById('srsDefaultMode').value,
          intervals: (document.getElementById('srsIntervals').value || '1,7,16,35,90').split(',').map(x => parseInt(x.trim(), 10) || 1)
        },
        diffLogger: {
          enabled: document.getElementById('diffLoggerEnabled').checked,
          triggerMode: document.getElementById('diffLoggerTriggerMode').value,
          debounceMs: Math.max(1000, parseInt(document.getElementById('diffLoggerDebounceMs').value, 10) || 10000),
          charThreshold: Math.max(1, parseInt(document.getElementById('diffLoggerCharThreshold').value, 10) || 100),
          trackedExtensions: (document.getElementById('diffLoggerTrackedExtensions').value || '.py,.ts,.js,.cpp,.java,.go').split(',').map(x => x.trim())
        },
        autoRating: {
          enabled: document.getElementById('autoRatingEnabled').checked,
          requireConfirmation: document.getElementById('autoRatingRequireConfirmation').checked
        },
        diffRetention: document.getElementById('diffRetention').value
      };
    }
    function notifyChange() { vscode.postMessage({ type: 'update', config: collectConfig() }); }

    document.getElementById('add-plan').onclick = () => {
      const container = document.getElementById('plans-container');
      const div = document.createElement('div');
      div.className = 'plan-row';
      div.innerHTML = \`
        <div class="plan-row-top">
          <input type="text" class="plan-slug" placeholder="e.g. neetcode-150" />
          <input type="text" class="plan-name" placeholder="Display name" />
          <button class="btn-remove" title="Remove">×</button>
        </div>
        <div class="plan-row-path">
          <input type="text" class="plan-path" placeholder="Optional: .leetplus/data/neetcode-150.json" />
          <button type="button" class="btn-browse" title="Browse local JSON file">Browse...</button>
          <span class="source-badge api" title="Problems fetched from LeetCode API">🌐 LeetCode API</span>
        </div>\`;
      container.appendChild(div);
      notifyChange();
    };

    document.getElementById('add-problem-list').onclick = () => {
      const container = document.getElementById('problem-lists-container');
      const div = document.createElement('div');
      div.className = 'list-row';
      div.innerHTML = '<input type="text" class="list-slug" placeholder="e.g. graph" /><input type="text" class="list-name" placeholder="Display name" /><button class="btn-remove" title="Remove">×</button>';
      container.appendChild(div);
      notifyChange();
    };

    document.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.btn-remove');
      if (removeBtn) {
        const row = removeBtn.closest('.plan-row, .list-row');
        if (row) {
          row.remove();
          notifyChange();
          return;
        }
      }
      const browseBtn = e.target.closest('.btn-browse');
      if (browseBtn) {
        // Find the plan-row this button belongs to and get its index from the DOM order
        const planRow = browseBtn.closest('.plan-row');
        const planRows = Array.from(document.querySelectorAll('.plan-row'));
        const planIndex = planRow ? planRows.indexOf(planRow) : -1;
        vscode.postMessage({ type: 'browseFile', planIndex });
      }
    });

    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('plan-path')) {
        const rowPath = e.target.closest('.plan-row-path');
        if (rowPath) {
          const badge = rowPath.querySelector('.source-badge');
          if (badge) {
            const hasPath = e.target.value.trim().length > 0;
            badge.className = 'source-badge ' + (hasPath ? 'local' : 'api');
            badge.title = hasPath ? 'Problems loaded from local file' : 'Problems fetched from LeetCode API';
            badge.textContent = hasPath ? '📁 Local file' : '🌐 LeetCode API';
          }
        }
      }
      notifyChange();
    });

    document.addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'number') {
        notifyChange();
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'fileSelected' && msg.path) {
        // Locate the input by its plan row index — safe even if DOM was re-rendered
        const planRows = Array.from(document.querySelectorAll('.plan-row'));
        const row = typeof msg.planIndex === 'number' ? planRows[msg.planIndex] : null;
        const input = row ? row.querySelector('.plan-path') : null;
        if (input) {
          input.value = msg.path;
          input.dispatchEvent(new Event('input'));
        }
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class LeetPlusConfigEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    let isSelfUpdating = false;

    const updateWebview = () => {
      const config = parseConfig(document.getText());
      webviewPanel.webview.html = getWebviewContent(config, webviewPanel.webview);
    };

    updateWebview();

    const changeDocSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (isSelfUpdating) return;
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "update" && msg.config) {
        isSelfUpdating = true;
        try {
          const json = configToJson(msg.config as LeetPlusConfig);
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, fullRange, json);
          const applied = await vscode.workspace.applyEdit(edit);
          if (applied) {
            await document.save();
          }
        } catch (e) {
          console.error("Failed to save config editor update:", e);
        } finally {
          isSelfUpdating = false;
        }
      } else if (msg.type === "browseFile") {
        const planIndex: number = typeof msg.planIndex === "number" ? msg.planIndex : -1;
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { "JSON Files": ["json"] },
          title: "Select Study Plan JSON File",
        });
        if (uris && uris[0]) {
          const selectedPath = uris[0].fsPath;
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(uris[0]);
          let relPath = selectedPath;
          if (workspaceFolder) {
            relPath = path.relative(workspaceFolder.uri.fsPath, selectedPath);
          }
          relPath = relPath.replace(/\\/g, "/");
          webviewPanel.webview.postMessage({ type: "fileSelected", path: relPath, planIndex });
        }
      }
    });
  }
}
