# Decisions

Dated log (Asia/Qatar). Newest last.

## 2026-10-18
- **Name and brand: "Knightlight".** The logo is an original knight head inside a crescent of light (`public/favicon.svg`). Palette: ink-teal `#0F3D3E`, amber `#F2A541`, cream `#FFF8EC`, coral `#E4572E` (errors), leaf `#3BB273` (success). No third-party names, likenesses or assets.
- **Stack versions moved past the plan's "React 18 / Tailwind 3".** Current stable versions are React 19.3, Tailwind 4.3, Vite 8.3 and Vitest 5. react-chessboard 5.x requires React 19, so the newer versions are the natural choice.
- **TypeScript 6.0.3, not 7.0.** typescript-eslint 8.71 supports TS `<6.1`, and lint must stay clean.
- **Puzzle CSV schema changed.** It now has an 11th column, `DailyDate`, after `OpeningTags` (checked on database.lichess.org on 2026-10-18). The pipeline reads columns by header name and ignores unknown ones.
- **Openings repo:** the root `a.tsv`–`e.tsv` files carry only `eco`, `name` and `pgn`. `uci` and `epd` exist only in the generated `dist/`, so the build script derives them with chess.js.
- **No system `zstd`.** Decompression uses the `fzstd` npm package (MIT) in streaming mode.
- **Content format: one PGN game = one step.** Consecutive games sharing `[Lesson]` form a lesson. This keeps the files standard PGN. See docs/AUTHORING.md.
- **Agent setup partly blocked.** The Claude Code permission classifier denied writing four agent definition files: `~/.claude/agents/debugger.md`, `~/.claude/agents/release-engineer.md`, `.claude/agents/chess-content-author.md` and `.claude/agents/chess-fact-checker.md`. `implementer`, `test-engineer` and `code-reviewer` were written. Custom agents also don't load mid-session. All seven bodies are kept in `docs/agent-prompts/` and run as general-purpose subagents with that body as the prompt, per plan amendment Step E.
- **esbuild install script approved** (`npm install-scripts approve esbuild`). tsx and Vite need its native binary.
