// Claude Code hooks. After each Edit/Write (`edited`): format the file and note it. When Claude
// ends its turn (`stop`): lint the noted files once and send remaining errors back (exit code 2)
// so it fixes them before handing over. Linting every edit flagged half-written states, such as
// an import added before its first use, and cost a type-aware run per edit.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const input = JSON.parse(readFileSync(0, 'utf8'));
const noted = path.join(tmpdir(), `claude-edited-${input.session_id}.txt`);
const bin = (name) => path.join(root, 'node_modules', '.bin', name);

if (process.argv[2] === 'edited') {
  const file = input.tool_input?.file_path;
  if (typeof file !== 'string' || !/\.[cm]?[jt]sx?$/.test(file)) process.exit(0);
  // Only this checkout: a sibling checkout such as `reforma-digital-2` shares the path prefix.
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) process.exit(0);
  spawnSync(bin('prettier'), ['--write', '--log-level=silent', file], { cwd: root });
  appendFileSync(noted, `${relative}\n`);
  process.exit(0);
}

// Already continuing because of this hook: CI catches what is left instead of looping.
if (input.stop_hook_active || !existsSync(noted)) process.exit(0);
const files = [...new Set(readFileSync(noted, 'utf8').split('\n'))].filter(
  (f) => f && existsSync(path.join(root, f)),
);
rmSync(noted);
if (files.length === 0) process.exit(0);
const lint = spawnSync(bin('oxlint'), ['--deny-warnings', ...files], {
  cwd: root,
  encoding: 'utf8',
});
// Without `pnpm install` there is nothing to run; CI still lints the change.
if (lint.error) process.exit(0);
if (lint.status !== 0) {
  process.stderr.write(`${lint.stdout}${lint.stderr}`);
  process.exit(2);
}
