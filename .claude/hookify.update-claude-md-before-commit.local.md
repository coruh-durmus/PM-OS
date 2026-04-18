---
name: update-claude-md-before-commit
enabled: true
event: bash
pattern: git\s+commit
action: warn
---

**CLAUDE.md audit required before committing.**

Before proceeding with this git commit, you MUST run the `/claude-md-management:claude-md-improver` skill to ensure CLAUDE.md is up to date with any changes made in this session.

Steps:
1. Invoke the `claude-md-management:claude-md-improver` skill
2. Review the quality report
3. Apply any recommended updates
4. Then proceed with the commit (include CLAUDE.md changes in the commit if updated)

This ensures CLAUDE.md always reflects the current state of the codebase.
