# Changelog Fragments

Add a short fragment for production-meaningful changes before commit.

Format:

```markdown
---
type: docs|feature|fix|security|ops|chore
surface: contracts|runtime|policy|tools|memory|context|artifacts|observability|cli|sdk|docs|repo
---

Short plain-language description of the change and verification evidence.
```

Fragments must not contain secrets, account tokens, signed URLs, or private provider data.
