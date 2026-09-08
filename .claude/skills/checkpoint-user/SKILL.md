---
name: checkpoint-user
description: Use when the user runs /checkpoint-user or asks to save session continuation state - creates or updates docs/session-checkpoints/SESSION_CHECKPOINT_<name>.md with a compact summary of current objective, state, decisions, and next steps.
---

Create or update docs/session-checkpoints/SESSION_CHECKPOINT_<name>.md.

Determine <name>:

If the user supplies a name or topic when invoking the skill (e.g. "/checkpoint-user book_research"), use it, lowercased with underscores in place of spaces.
Otherwise, derive a short, stable slug from the session's current objective/topic (e.g. book_research, nutrition_ui).
Reuse the same <name> for later checkpoints on the same task so updates land in the existing file rather than creating duplicates. If unsure whether an existing checkpoint matches the current task, check docs/session-checkpoints/ for a close match before picking a new name.

Capture only the information necessary to continue the current work after /compact or in a new session.

Use this structure:

Current Objective
Current State
Files Changed
Important Decisions
Constraints
Problems / Unresolved Issues
Failed Approaches
Next Steps
Important Context

Rules:

Do not modify source code or any file other than the target docs/session-checkpoints/SESSION_CHECKPOINT_<name>.md file (create the docs/session-checkpoints/ directory if it does not yet exist).
Use the current conversation as the primary source; inspect other files only when necessary to verify important facts.
Do not perform implementation, testing, builds, installation, broad repository exploration, or unrelated work.
Keep the checkpoint concise and remove obsolete or redundant information.
Do not invent missing information.

After updating the checkpoint, briefly state which file was updated and the next recommended action. Do not perform that action.
