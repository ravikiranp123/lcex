# Project Rules for LeetPlus Workspace

These rules apply specifically to all development tasks in the LeetPlus codebase. All agents invoked in this workspace must conform to these protocols.

## 1. Project Identity & Namespace
*   **Name & ID:** The extension name is `leet-plus` (identifier) and `LeetPlus` (display name).
*   **Prefixes:** Always use `leetplus.` as the prefix for all command IDs, context keys, settings, and status bar actions.
*   **Config Directory:** Workspace configurations must be read/written to `<workspace>/.leetplus/config.json`.
*   **Legacy Codes:** Avoid references to legacy `lcex` or `leetcode-practice` (except when tracking upstream branch divergence).

## 2. Diagram Pipeline (Mermaid to Excalidraw)
*   **AI Generation:** When generating architecture/low-level design diagrams, the AI must output Mermaid syntax.
*   **Conversion:** The extension uses `@excalidraw/mermaid-to-excalidraw` on the client-side to convert Mermaid syntax to Excalidraw element coordinates locally.
*   **Display:** The webview loads the converted JSON inside the `@excalidraw/excalidraw` React component so the user receives a fully editable, drag-and-drop canvas.
*   **Direct JSON:** Raw Excalidraw JSON generation by the LLM is restricted to an opt-in beta toggle only.

## 3. UI Performance (Staged Rating Pipeline)
*   **Instant Confirmation:** When the user clicks "Complete", immediately save the local snapshot to `state.json` (0ms) and open the rating review panel in a loading/skeleton state.
*   **Async Processing:** Trigger the AI auto-rating in the background 2 seconds later. If the AI is offline or times out (5s), seamlessly fall back to `HeuristicRater.ts` (offline heuristic fallback using `ComplexityBudget`, `ConstraintParser`, and `EmpiricalFit`).

## 4. Development Workflow
*   **Media/Visual Assets:** Defer screenshot generation, GIF recording, and final asset preparation to the very end of development, right before publishing.
*   **Interaction Discipline:** When the user asks a question, answer the question directly. Do NOT jump the gun and modify files or run actions without explicit permission.
*   **Testing & Verification Guidance:** After completing every development task, the agent must provide clear step-by-step instructions on how to manually verify the change in the running extension. When relevant, the agent should assist by providing/updating sample code, files, or `state.json` templates to trigger and test specific execution paths. Workspace is initialised in ~/projects/leetplus. So you will have ~/projects/leetplus/.leetplus. Inform user if you cant find it.


