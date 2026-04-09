---
description: How to correctly end a development session and save progress history
---

# Session Archiving Workflow

When the USER requests to "finish the session" or "save progress", you must execute this workflow to ensure the next agent has complete context.

1.  **Ask for the Version Number**
    If the USER hasn't provided a version number (like `3.01`), ask them for it.

2.  **Create the Archive Directory**
    Create a new nested directory for this specific session iteration:
    `mkdir -p docs/sessions/{VERSION}`

3.  **Copy the Brain Artifacts**
    Copy your current internal artifacts into the new public directory to freeze them in time:
    `cp .gemini/antigravity/brain/*/implementation_plan.md docs/sessions/{VERSION}/implementation_plan.md`
    `cp .gemini/antigravity/brain/*/walkthrough.md docs/sessions/{VERSION}/walkthrough.md`

4.  **Update Documentation (Consolidation)**
    -   **Important Architecture changes?** -> Update `docs/ARCHITECTURE.md`.
    -   **New Feature completed?** -> Append summary to `docs/PROJECT_OVERVIEW.md` with link to the new walkthrough.
    -   **Leftover tasks or Debt?** -> Update `docs/BACKLOG.md`.

5.  **KI Cleanup Recommendation**
    Explicitly tell the system: "Delete all Knowledge Items (KIs) related specifically to the technical details of this session as they are now consolidated in the project documentation."

6.  **Run Security Scan**
    Execute a global search (grep) to ensure no hardcoded secrets or sensitive IP addresses remain in the repository:
    `grep -rE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9-]+\.atlassian\.net|(password|secret|token|api_?key|auth|pwd)[\s:=]+['\"][a-zA-Z0-9\/=+\-_]{16,}['\"]" . --exclude-dir node_modules --exclude-dir .git --exclude-dir dist
`
    If ANY matches are found, you MUST replace them with placeholders (e.g., `<YOUR_IP>`, `<YOUR_EMAIL>`) before proceeding!

7.  **Commit and Push All Changes**
    Commit ALL files (including source code changes, new artifacts, and the history docs) to git so they are perfectly aligned. The commit message MUST BE the version number. Finally, push to the remote repository:
    `git add .`
    `git commit -m "{VERSION}"`
    `git push`