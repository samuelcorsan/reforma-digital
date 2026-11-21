// PostToolUse hook: formats and lints the file Claude just edited. Remaining lint errors go
// back to Claude (exit code 2) so it fixes them in the same loop instead of waiting for CI.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path;
if (typeof file !== 'string' || !file.startsWith(root) || !/\.[cm]?[jt]sx?$/.test(file)) {
  process.exit(0);
}

const bin = (name) => path.join(root, 'node_modules', '.bin', name);
spawnSync(bin('prettier'), ['--write', '--log-level=silent', file], { cwd: root });
const lint = spawnSync(bin('oxlint'), ['--fix', '--deny-warnings', file], {
  cwd: root,
  encoding: 'utf8',
});
// Without `pnpm install` there is nothing to run; CI still lints the change.
if (lint.error) process.exit(0);
if (lint.status !== 0) {
  process.stderr.write(`${lint.stdout}${lint.stderr}`);
  process.exit(2);
}
