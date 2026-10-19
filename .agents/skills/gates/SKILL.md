---
name: gates
description: Run Knightlight's project gates (typecheck, lint, tests, content validator, puzzle size, reviewed-course count) and show the pass/fail/warn table.
disable-model-invocation: true
---

# Gates

1. From the repo root, run `node scripts/gates.mjs`. It can take a few minutes; use a timeout of at least 300000 ms.
2. Show the user the final table exactly as printed, plus the exit code.
3. For each FAIL, quote the relevant lines of output the script printed above the table (the failing command's output) so the cause is visible.
4. A WARN on "reviewed: true courses" is expected while the coach signs courses off; just report it.
5. Fix nothing. Do not edit files, re-run with changes, or dispatch agents unless the user asks.
