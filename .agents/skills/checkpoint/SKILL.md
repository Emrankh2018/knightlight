---
name: checkpoint
description: Checkpoint Knightlight - run the gates, update PROGRESS.md, write a short vault handoff note, then propose a commit for the user to approve before release-engineer commits it.
disable-model-invocation: true
---

# Checkpoint

Do these steps in order. Stop and report if a step fails in a way you cannot report around.

## 1. Run the gates
Run `node scripts/gates.mjs` (timeout at least 300000 ms) and keep the final table. Do not fix anything; a red gate is recorded, not repaired.

## 2. Update PROGRESS.md
Read `PROGRESS.md` first. Update only these sections, keeping the existing style and the session rules:
- **Done (verified):** add work completed since the last checkpoint, only if verified in this session.
- **Status:** replace with the gates table results from step 1 (real numbers, failing gates named).
- **Next (in order):** remove finished items; add newly found work.
Use Asia/Qatar dates.

## 3. Vault handoff note
- Vault: `C:/Users/welcome/AI-Codex-Brain/Handoffs/`. If that path does not exist, skip this step and say so in the report.
- Look for an existing Knightlight note (`*-Codex-knightlight-*.md`). If one exists, read it fully, then append a short dated entry; never rewrite other content. Otherwise create `YYYY-MM-DD-claude-knightlight-checkpoint.md`.
- Fields: Author, Date, Completed, Pending, Blockers, Evidence pointers (commit SHA or file paths), Next bounded action.
- Keep it short. No secrets, tokens, environment values or personal data.

## 4. Propose the commit
- Show the user: `git status --short`, the list of files to stage, and the proposed commit message (imperative subject ≤ 72 characters, short body).
- Never stage `.cache/`, `node_modules/`, `dist/`, `.tmp/` or anything from `~/.Codex`.
- Wait for the user's explicit approval. Only after approval, dispatch `release-engineer` (or a general-purpose agent with `docs/agent-prompts/release-engineer.md` as its prompt if the agent is not loaded) with the exact file list and message to commit. Do not push.
- Re-check `git log -1 --stat` after it reports.
