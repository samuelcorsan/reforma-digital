# Repository instructions

## Scope and Ponytail

- Before implementing a code change, read and use [Ponytail](.agents/skills/ponytail/SKILL.md). Use its default `full` mode unless the user specifies another mode. Let it guide reuse, dependencies, abstractions, and the smallest correct solution.
- Before requesting review, run an independent correctness review of the complete task diff in a fresh context, preferably with the model that did not write it: `/code-review` in Claude Code or `/review` in Codex. It follows the [review guidelines](#review-guidelines). Fix or rebut every finding, then run [Ponytail Review](.agents/skills/ponytail-review/SKILL.md) as a separate simplicity pass. Fix bugs before simplifying.
- Stay within the requested objective. Do not include unrelated linting, formatting, refactoring, or import changes. A Ponytail finding does not authorize a repository-wide cleanup.
- Preserve user-owned changes. Report unrelated findings without fixing them or creating issues automatically.
- Challenge unnecessary complexity with a concrete alternative. Do not simplify away explicitly requested behavior, validation, security, accessibility, or error handling.

## Repository sources and ownership

- Read [CONTRIBUTING.md](CONTRIBUTING.md) for development, portal contracts, and verification; [DESIGN.md](DESIGN.md) for UI changes; and [SECURITY.md](SECURITY.md) for security boundaries and reporting. Read only the documentation relevant to the task.
- Follow the nearest applicable `AGENTS.md`. In `apps/web`, follow its instructions for the installed Next.js version.
- Portal adaptations belong in `sites/<portal>`, shared capabilities in `packages/`, and application composition in `apps/`. Import other workspaces through their public exports and respect the existing dependency checks.
- Keep server dependencies out of browser code. Use the shared design components and tokens before adding new ones.
- Validate external input at its trust boundary. Preserve owned contracts internally instead of duplicating types, hiding failures behind defaults, or forcing incompatible values through casts.

## Portal and data boundaries

- For portal adaptations, preserve the original forms, validation, navigation, and security controls. Do not replace CAPTCHA, signatures, certificates, passwords, or file-upload controls.
- Do not extract cookies, tokens, or session data from official portals. If the DOM does not satisfy the adapter contract, preserve or restore the original interface.
- Distinguish synthetic fixtures, anonymized fixtures, and captures from the real portal. Fixture-based tests are not evidence that the real portal was verified.
- Do not include personal data or secrets in fixtures, logs, screenshots, commits, or PRs.

## Verification and temporary changes

- Add or modify tests only when they directly cover behavior introduced or fixed by the task. Use the existing test tools and test observable behavior or contracts, not the implementation's shape.
- Select verification proportional to the change. Documentation-only changes do not need new tests or a full application build.
- Use the existing commands: `pnpm lint` for semantic and anti-slop checks, `pnpm check` for repository checks (including lint), `pnpm test:e2e` for relevant browser behavior, and `pnpm exec prettier --check <files>` for formatting. Use focused checks while iterating; format only files belonging to the change.
- Fix the cause of lint findings. Do not add casts, wrappers, renames, or disable comments to evade a rule. Lint configuration and scope changes must belong to the authorized objective.
- For visible UI changes, provide screenshots or recordings when they help verify the result. Report commands actually run, their results, and any expected verification left pending.
- Do not keep changes to test harnesses, E2E runners, fixtures, environment defaults, build configuration, package manifests, lockfiles, or logging merely to make local verification pass.
- Remove temporary verification and debugging changes before finishing. State what was temporarily changed and that it was removed. Never commit or push local-only workarounds without explicit authorization.
- Do not relax rules, timeouts, assertions, exclusions, or baselines to admit your implementation. Tooling changes must belong to the authorized objective. If a local workaround appears necessary as a permanent production change, explain it and ask before keeping it.
- When unsure whether a test, configuration, dependency, or harness change belongs to the task, ask before adding it.

## Git and pull requests

- Name new branches `<user>/feature-name`, using the contributor's GitHub username and a descriptive kebab-case feature name. Do not use another contributor's username or an agent name as the prefix.
- Use `type(scope): concrete result` for commit and PR titles. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, and `chore`. Use a scope matching the affected area.
- For PR titles, write the title text after the `type(scope):` prefix in Spanish, preserving technical identifiers. Example: `feat(search): añade filtros por organismo`.
- Write commit and PR descriptions in Spanish, preserving technical identifiers. Example: `fix(chat): conserva la respuesta al cancelar la búsqueda`.
- Keep one objective per PR and under about 1,500 hand-written changed lines; split larger work. Generated data, captured fixtures and lockfiles do not count. Complete the [PR template](.github/pull_request_template.md). Link the relevant issue; use `Closes #N` only when the PR resolves it. Trivial changes do not require an issue solely for process.
- Update the PR description when its scope changes. Identify material agent assistance and the verification performed.
- Do not merge or deploy without authorization for that action. Respect GitHub's required checks and any required reviews; do not bypass them.
- Every review comment, human or automated, ends fixed or answered with a reason. Never resolve one silently.

## Review guidelines

For automated reviewers (Codex, Claude) and humans reviewing a pull request.

- Report only problems that matter: wrong behavior, an unhandled error that loses data, exposure of secrets or personal data, injection, a broken API, data or portal contract, a test deleted, skipped or weakened to pass, new branching logic without a test, or a lint, CI or test rule relaxed to admit the change.
- Each finding cites `file:line` and a concrete failure scenario. No speculative "consider…" comments. Style belongs to oxlint, Prettier, TypeScript and ruff; over-engineering to Ponytail Review.
- Read the test changes first. An assertion changed to match new output is a finding unless the PR explains why the old expectation was wrong.
- Always check that portal adaptations keep the original controls and stop before personal data or CAPTCHA, that extension code does not reach forbidden network or storage APIs, that workflows never run pull request code with secrets, and that changes to lint configuration, `knip.json`, `ruff.toml` or workflows belong to the PR's objective.
- Skip `pnpm-lock.yaml`, generated data and fixtures captured from official portals.

## Delivery

- Explain what changed, why, and how it was verified. State concrete limitations and pending decisions.
- Distinguish executed evidence from inference. Never claim that a test, manual check, or live-portal verification ran when it did not.
- Shared skills live in `.agents/skills/`. The `.claude/skills/` and `.cursor/skills/` links point to that source; edit the source rather than maintaining separate copies.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
