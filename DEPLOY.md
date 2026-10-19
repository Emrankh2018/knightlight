# Deploying Knightlight

The app is built with a configurable base path (`BASE_PATH`, default `/knightlight/`, for GitHub Pages).
The live Cloudflare Workers site serves from the root, so it must be built with `BASE_PATH=/`.

```
npm run deploy:cloudflare
```

This runs `scripts/deploy.mjs`, which sets `BASE_PATH=/` through Node's `process.env`, runs `npm run build`,
then `npx wrangler deploy --assets dist --name knightlight --compatibility-date 2026-10-12`.
It works from any shell. Do not set `BASE_PATH=/` on the command line in Git Bash: it turns the value into a Windows path.

Wrangler must be logged in first (`npx wrangler login`). To check a root-path build without deploying:
`node -e "process.env.BASE_PATH='/'; require('child_process').spawnSync('npm',['run','build'],{stdio:'inherit',shell:true})"`
and confirm `dist/index.html` references `/assets/...`.

PWA icons are rendered from `public/favicon.svg` with `node scripts/make-icons.mjs`.
