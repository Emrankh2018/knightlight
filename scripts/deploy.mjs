// Builds for a root-path host (Cloudflare Workers assets) and deploys with wrangler.
// BASE_PATH is set through process.env so it is not mangled by Git Bash path conversion.
import { spawnSync } from 'node:child_process';

const env = { ...process.env, BASE_PATH: '/' };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(npm, ['run', 'build']);
run(npx, ['wrangler', 'deploy', '--assets', 'dist', '--name', 'knightlight', '--compatibility-date', '2026-10-12']);
