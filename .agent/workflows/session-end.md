---
description: How to correctly end a development session and save progress history
---

# Session Archiving Workflow

When the USER requests to "finish the session" or "save progress", you must execute this workflow to ensure the next agent has complete context.

1.  **Ask for the Version Number**
    If the USER hasn't provided a version number (like `v3.01`), ask them for it.

2.  **Create the Archive Directory**
    Create a new nested directory for this specific session iteration:
    `mkdir -p docs/sessions/{VERSION}`

3.  **Copy the Brain Artifacts**
    Copy your current internal artifacts into the new public directory to freeze them in time:
    `cp .gemini/antigravity/brain/*/task.md docs/sessions/{VERSION}/task.md`
    `cp .gemini/antigravity/brain/*/implementation_plan.md docs/sessions/{VERSION}/implementation_plan.md`

4.  **Append a Summary**
    Prepend a 2-3 sentence summary at the very top of `docs/sessions/{VERSION}/task.md` detailing precisely what was achieved in this session.

5.  **Commit the History**
    Commit these documentation files to git so they are permanently tracked:
    `git add docs/sessions/{VERSION}`
    `git commit -m "docs: archive session {VERSION} progress"`
