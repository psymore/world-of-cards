---
name: checkpoint-and-compact
description: Use when the user runs /checkpoint-and-compact or asks to checkpoint and compact the session - saves session continuation state via the checkpoint-user skill, then prompts the user to run /compact.
---

Run the checkpoint-user skill first, using the same <name> resolution rules it defines (user-supplied name/topic, or a slug derived from the session's current objective, reusing an existing matching file in docs/session-checkpoints/ when one exists).

Do not attempt to invoke /compact directly — it is a CLI-native command and cannot be triggered programmatically from within a skill.

After the checkpoint is written, tell the user which file was updated and that the session is ready to compact, then explicitly instruct them to run /compact now. Do not perform any other action.
