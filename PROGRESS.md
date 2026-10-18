# Progress

Resumable status. Update after every milestone.

## Done
- Step 0: agent prompts (see DECISIONS.md for the blocked files), repo `AGENTS.md`/`CLAUDE.md`, generic `~/AGENTS.md` (backup at `~/AGENTS.md.bak`).
- M0: scaffold (Vite 8 + React 19 + TS strict + Tailwind 4 + PWA), i18n file, content model types, layout shell. Typecheck, lint and build pass.

## Next
- M1: PGN tokenizer, parser and validator CLI, docs/AUTHORING.md, sample course and tests.

## Known issues
- PNG app icons (`icon-192.png`, `icon-512.png`) aren't generated yet. ffmpeg can't read the SVG; render them with Playwright in M8.
