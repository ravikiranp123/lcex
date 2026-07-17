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
