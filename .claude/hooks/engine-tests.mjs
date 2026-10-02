// PostToolUse (Edit|Write): after an engine file changes, run the engine tests.
// Exit 2 on failure so Claude sees the summary on stderr.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const file = String(input.tool_input?.file_path ?? '').replace(/\\/g, '/');
if (!file.includes('/server/src/extensions/engine/') && !file.startsWith('server/src/extensions/engine/')) {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const pkgPath = join(root, 'server', 'package.json');
if (!existsSync(pkgPath)) process.exit(0);
try {
  if (!JSON.parse(readFileSync(pkgPath, 'utf8')).scripts?.test) process.exit(0);
} catch {
  process.exit(0);
}

const r = spawnSync('npm', ['test', '--workspace', 'server', '--', 'engine'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  timeout: 120_000,
});
if (r.status === 0) process.exit(0);

const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split(/\r?\n/);
console.error(`Engine tests failed after editing ${file.split('/').pop()}:\n${out.slice(-30).join('\n')}`);
process.exit(2);
