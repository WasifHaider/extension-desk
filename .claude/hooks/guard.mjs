// PreToolUse (Edit|Write): block edits to the spec, real .env files and .git internals.
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const norm = (p) => String(p ?? '').replace(/\\/g, '/');
const file = norm(input.tool_input?.file_path);
const root = norm(process.env.CLAUDE_PROJECT_DIR || input.cwd).replace(/\/+$/, '');

const lower = file.toLowerCase();
const rel = root && lower.startsWith(root.toLowerCase() + '/') ? file.slice(root.length + 1) : file;
const base = rel.split('/').pop();

if (rel.toLowerCase() === 'docs/spec.md') {
  console.error('docs/SPEC.md is the source of truth; tell the user instead of editing it');
  process.exit(2);
}
if (base.startsWith('.env') && base !== '.env.example') {
  console.error(`${base} holds secrets; ask the user to edit it, and put new keys in .env.example`);
  process.exit(2);
}
if (('/' + rel).includes('/.git/')) {
  console.error('Files under .git/ must not be edited directly; use git commands');
  process.exit(2);
}
process.exit(0);
