---
description: How to correctly start a new development session and restore context
---

# Session Start Workflow

When a new agent starts a session, it must follow these steps to gain full context efficiently without consuming excessive tokens.

1.  **Read Global Status**
    -   Read `docs/PROJECT_OVERVIEW.md` to understand the current high-level status of the project.
    -   Read the top section of `docs/BACKLOG.md` (Roadmap) to understand the current strategic direction.

2.  **Restore Last Session Context**
    -   Identify the latest version from `docs/PROJECT_OVERVIEW.md`.
    -   Read the corresponding `docs/sessions/{VERSION}/walkthrough.md` to see what was exactly implemented last.
    -   Read `docs/sessions/{VERSION}/implementation_plan.md` if there were unfinished tasks or if technical debt was mentioned.

3.  **Consult Technical Standards**
    -   Read `docs/ARCHITECTURE.md` to ensure any new code follows the established patterns (Hexagonal Architecture, Naming conventions).
    -   Check for existing Knowledge Items (KIs) by reading the KI summaries provided in the system prompt.

4.  **Confirm Task with User**
    -   Summarize your understanding of the current state.
    -   Propose 1-2 next steps from `docs/BACKLOG.md` or ask the USER for the immediate task.

5.  **Initialize Session Artifacts**
    -   Create a new `.gemini/antigravity/brain/implementation_plan.md` for the current task.
    -   DO NOT start coding until the plan is approved by the USER.
