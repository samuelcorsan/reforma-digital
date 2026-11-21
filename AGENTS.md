# Repository instructions

## Scope and Ponytail

- Before implementing a code change, read and use [Ponytail](.agents/skills/ponytail/SKILL.md). Use its default `full` mode unless the user specifies another mode. Let it guide reuse, dependencies, abstractions, and the smallest correct solution.
- Before requesting review, run an independent correctness review of the complete task diff in a fresh context, preferably with the model that did not write it: `/code-review` in Claude Code or `/review` in Codex. It follows the [Code Review Rules](#code-review-rules). Fix or rebut every finding, then run [Ponytail Review](.agents/skills/ponytail-review/SKILL.md) as a separate simplicity pass. Fix bugs before simplifying.
- Stay within the requested objective. Do not include unrelated linting, formatting, refactoring, or import changes. A Ponytail finding does not authorize a repository-wide cleanup.
- Preserve user-owned changes. Report unrelated findings without fixing them or creating issues automatically.
- Challenge unnecessary complexity with a concrete alternative. Do not simplify away explicitly requested behavior, validation, security, accessibility, or error handling.

## Repository sources and ownership

- Read [CONTRIBUTING.md](CONTRIBUTING.md) for development, portal contracts, and verification; [DESIGN.md](DESIGN.md) for UI changes; and [SECURITY.md](SECURITY.md) for security boundaries and reporting. Read only the documentation relevant to the task.
- Follow the nearest applicable `AGENTS.md`. In `apps/web`, follow its instructions for the installed Next.js version.
- Portal adaptations belong in `sites/<portal>`, shared capabilities in `packages/`, and application composition in `apps/`. Import other workspaces through their public exports and respect the existing dependency checks.
- Keep server dependencies out of browser code. Use the shared design components and tokens before adding new ones.

## Writing code

`pnpm lint` (oxlint with types, anti-slop rules and knip in `pnpm check`) and ruff enforce most of this; the rest is for review.

- Validate external input at its trust boundary, then trust the types. Preserve owned contracts internally instead of duplicating types, hiding failures behind defaults, or forcing incompatible values through casts.
- No optional chaining, `??` defaults or guards for states the types say cannot happen. Missing required data is an error, not a silent fallback.
- Catch only the errors you expect and can handle, and rethrow the rest. Never return a default to hide a failure.
- Fix a defect where it originates, not where it surfaced: one fix in the shared function instead of a guard in every caller.
- Reuse what exists in `packages/` before writing a helper. Delete instead of deprecating: no compatibility shims, aliases or re-exports without a current consumer.
- Comments explain why, never what the code does.
- A defect your change introduced is fixed in the same PR, not left for later. When review catches the same mistake twice, propose a lint rule instead of another line here.

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

## Code Review Rules

`/code-review`, `/review` and human reviewers apply these; there is no automated review on PRs. Each finding cites `file:line` and a concrete failure scenario. Formatting, lint and types are CI's job; over-engineering is Ponytail Review's. Skip `pnpm-lock.yaml`, generated data and fixtures captured from official portals.

### Official portals

- Flag an adaptation that replaces, removes or bypasses an original CAPTCHA, signature, certificate, password or file-upload control, submits on the user's behalf, or reads cookies, tokens or session data. Users must complete the official procedure with its validation and security intact. Safe path: keep the control original, or bind it through `DomBridge` while the official control stays in its form (CONTRIBUTING.md).
- Flag new manifest permissions or host matches, and extension or site code that keeps or passes on what users type into official forms. The extension only stores its activation preferences in `chrome.storage.local` (SECURITY.md); lint and `audit:bundle` already block network, page-storage and dynamic-code APIs. Safe path: form data stays in the official form; server features belong in `apps/web`.

### Published data

- Flag a catch, fallback or default that turns a failed or missing source into plausible data shown to users, such as a zero count, an empty list or a stale result presented as current. This project publishes civic and electoral data; a silent default is misinformation. Safe path: an explicit error or empty state that says the data is unavailable.

### Tests and quality gates

- Flag a test deleted or skipped, an assertion changed to match new output, or a relaxed lint rule, timeout, retry, exclusion, debt list or CI step. Safe path: the PR description explains why the old expectation was wrong, or the change is the PR's stated objective.

### Secrets and personal data

- Flag secrets or personal data in fixtures, logs, screenshots or commits, and workflows that expose secrets to pull request code (`pull_request_target`, or secrets in jobs that run fork code). Safe path: synthetic or anonymized fixtures; secrets only in push, schedule or manual workflows and environments.

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
