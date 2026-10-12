# opencode, HumanStudy edition

A lightly patched fork of [anomalyco/opencode](https://github.com/anomalyco/opencode)
(formerly sst/opencode), maintained by HumanStudy Hub as the agent kernel of the desktop app.
Base: upstream tag `v1.18.21`. Branch: `humanstudy` (default). Everything not listed under
"Patches" is identical to upstream.

## Patches

Each patch is one commit on top of the upstream tag.

### 1. Branding

- `opencode --version` prints `opencode-humanstudy <upstream-version>` (for example
  `opencode-humanstudy 1.18.21`). The command name stays `opencode`, and
  `InstallationVersion` (used for plugin compatibility, `/global/health`, user agents) stays the
  plain upstream semver, so a substring check for the version keeps working.
- The CLI help banner adds a "HumanStudy Hub edition" line, and the help footer names the fork.
- Files: `packages/opencode/src/index.ts`, `packages/opencode/src/temporary.ts`.

### 2. Built-in provider `humanstudy`

`packages/opencode/src/config/humanstudy.ts` returns a baseline config object, and
`config.ts` starts config loading from it (`let result = humanstudyDefaults()`), so every real
config source (global, project, `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, managed) overrides it.

When `HUMANSTUDY_DESKTOP_KEY` is set, the baseline contains:

- `provider.humanstudy`: `@ai-sdk/openai-compatible`, name "HumanStudy"
  - `options.baseURL` = `HUMANSTUDY_HOSTED_BASEURL`, default `https://humanstudy-hub.com/api/desktop/v1`
  - `options.apiKey` = `HUMANSTUDY_DESKTOP_KEY`
  - `options.headers["x-vercel-protection-bypass"]` = `HUMANSTUDY_SERVER_BYPASS` (only when set)
  - models `anthropic/claude-sonnet-5.5` (200k ctx / 64k out), `anthropic/claude-haiku-5.5`
    (200k / 64k), `deepseek/deepseek-v4.1-flash` (128k / 32k), all with `tool_call: true`
- `model` = `humanstudy/anthropic/claude-sonnet-5.5`, `small_model` = `humanstudy/anthropic/claude-haiku-5.5`

Without the key nothing is added (no ghost, unauthenticated provider in the model list), and
the desktop app may still pass its own `model` / `provider` through `OPENCODE_CONFIG_CONTENT`.
The env vars are read when the server process starts.
