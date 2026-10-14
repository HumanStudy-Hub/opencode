# opencode, HumanStudy edition

A lightly patched fork of [anomalyco/opencode](https://github.com/anomalyco/opencode)
(formerly sst/opencode), maintained by HumanStudy Hub as the agent kernel of the desktop app.
Base: upstream tag `v1.19.0` (previous base `v1.18.21`, kept as tag `humanstudy-1.18.21-final`). Branch: `humanstudy` (default). Everything not listed under
"Patches" is identical to upstream.

## Patches

Each patch is one commit on top of the upstream tag.

### 1. Branding

- `opencode --version` prints `opencode-humanstudy <upstream-version>` (for example
  `opencode-humanstudy 1.19.0`). The command name stays `opencode`, and
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

### 3. Safe defaults

Same baseline object (lowest precedence, any config source overrides):

- `share: "disabled"`, `autoupdate: false`
- `experimental.openTelemetry: false`
- `permission`: `edit: "ask"`, `bash: "ask"`, `external_directory: "ask"`

Audit notes for upstream v1.19.0 (re-checked from v1.18.21; re-check on each rebase):

- No analytics SDK exists in `packages/opencode` or `packages/core`. The only telemetry path is
  OTLP export, active only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, plus AI SDK spans
  when `experimental.openTelemetry` is true (now defaulted to false).
- Network calls that remain, none carrying user content: the model catalog from
  `https://models.opencode.ai` (set `OPENCODE_DISABLE_MODELS_FETCH=1` to stop it; an embedded
  snapshot is used), and the npm install of `@opencode-ai/plugin` into config dirs.
- New in v1.19.0, checked: autoupdate no longer installs anything; it only checks
  `Installation.latest()` and shows a notice in the TUI (`/update` dialog). `autoupdate: false` (our
  default) and `OPENCODE_DISABLE_AUTOUPDATE` still skip the check. `opencode upgrade --major` (manual
  CLI only) can fetch `https://opencode.ai/v2/install` or swap packages for OpenCode 2; nothing in
  `serve` calls it. `POST /global/upgrade` now requires `{target: <semver>}`.
- New in v1.19.0: config files and `OPENCODE_CONFIG_CONTENT` pass through `config/v2-compat.ts`,
  which lowers OpenCode 2 keys (`snapshots`, `skills` arrays, `agents`, `model` objects, ...) to V1
  and rejects V2 `permissions` (plural) with a config error. V1 `permission` and `provider/model`
  strings are untouched. The humanstudy baseline is not routed through it.
- New in v1.19.0: every provider fetch gets a default 300 s header timeout and 300 s
  SSE chunk timeout (`provider.<id>.options.headerTimeout|chunkTimeout`, `false` disables).
- No new analytics, share, telemetry or default-permission changes. New URLs in the diff are
  Cloudflare AI Gateway / Azure provider endpoints (used only when those providers are configured)
  and the OpenCode 2 links above.
- Upstream tests that assert pristine defaults fail by design on this fork (`share` default,
  `permission` key order, `permission` undefined in v2-compat loading): 3 tests in `test/config`.
- Instructions: `AGENTS.md` is found by walking up from the working directory to the worktree root
  (upstream behaviour; falls back to `CLAUDE.md`, and also reads `~/.config/opencode/AGENTS.md` and
  `~/.claude/CLAUDE.md`). Skills load from `.opencode/{skill,skills}/**/SKILL.md` (also
  `.claude/skills` and `.agents/skills`). Both unchanged.

### 4. Tool events carry full input and output

Upstream already publishes the complete tool part in `message.part.updated` (the whole part is
cloned into the event: `state.input`, `state.output`, `state.metadata`). The only cut is
the model-facing truncation of tool output at 2000 lines / 50 KB, with the full text written to a
file named in `metadata.outputPath`. To satisfy "up to 64 KB in the event" the baseline sets
`tool_output.max_bytes = 65536` (a config default, overridable). Output beyond that is
truncated for the event exactly as it is for the model; the full text is in `metadata.outputPath`.
The `read` tool keeps its own upstream 50 KB paging cap.

## Precedence and isolation

The baseline from patches 2 to 4 is the lowest-precedence layer. Anything the user has in
`~/.config/opencode/opencode.json[c]`, in the project, or in `OPENCODE_CONFIG_CONTENT` wins. A
personal global config that sets `model` therefore beats the built-in `humanstudy` default. A host
that must be deterministic (the desktop app) should either pass `model` in `OPENCODE_CONFIG_CONTENT`
or give the server its own `XDG_CONFIG_HOME` / `XDG_DATA_HOME` / `XDG_STATE_HOME` / `XDG_CACHE_HOME`.

## Build

Needs Bun matching `packageManager` in the root `package.json` (1.3.14 or newer, tested with 1.4.3).

```bash
bun install
cd packages/opencode
# current platform only; OPENCODE_VERSION is the upstream semver, not a HumanStudy revision
OPENCODE_VERSION=1.19.0 OPENCODE_CHANNEL=latest bun run script/build.ts --single --skip-install
./dist/opencode-darwin-arm64/bin/opencode --version     # opencode-humanstudy 1.19.0
```

Notes:

- The build embeds the web UI by running `vite build` in `packages/app`. On a Mac whose Node is an
  x64 build running under Rosetta, vite fails on `@rollup/rollup-darwin-x64`; pass
  `--skip-embed-web-ui` for local builds (the desktop app only needs the HTTP API). CI builds on
  native Linux and embeds the UI, as upstream does.
- `--baseline` adds the x64 no-AVX2 variant on x64 hosts; without `--single` every target is built.
- Build downloads the models.dev snapshot (`OPENCODE_MODELS_DEV`), so it needs network access.

## Release

Workflow: `.github/workflows/release-humanstudy.yml`.

```bash
git tag hs-v1.19.0         # or hs-v1.19.0-2 for a second HumanStudy build of the same upstream version
git push origin hs-v1.19.0
```

The tag builds every Bun target on one Linux runner (like upstream's `build-cli`), zips six of them
and attaches the zips and `SHA256SUMS.txt` to a GitHub release named after the tag. The binary
reports the upstream semver (the part after `hs-v`, before any `-<revision>`), because the plugin
compatibility check and `@opencode-ai/plugin` installs depend on a plain semver.

| Asset | Platform |
|---|---|
| `opencode-humanstudy-darwin-arm64.zip` | macOS Apple silicon |
| `opencode-humanstudy-darwin-x64.zip`, `-darwin-x64-baseline.zip` | macOS Intel (AVX2 / no AVX2) |
| `opencode-humanstudy-windows-x64.zip`, `-windows-x64-baseline.zip` | Windows x64 (AVX2 / no AVX2) |
| `opencode-humanstudy-windows-arm64.zip` | Windows on Arm |
| `SHA256SUMS.txt` | `sha256sum` format, one line per zip |

Each zip holds a single file at its root: `opencode` (`opencode.exe` on Windows). Linux is not built.
A manual `workflow_dispatch` run builds and uploads workflow artifacts without creating a release.

## How the desktop app consumes it

`app/src/main/opencode-install-core.ts` in `humanstudy-desktop` should change from the pinned
upstream release to this one:

- `RELEASE_BASE` becomes
  `https://github.com/HumanStudy-Hub/opencode/releases/download/<tag>` (for example `hs-v1.18.21`).
  The tag and the semver can differ (`hs-v1.18.21-2` ships `1.18.21`), so keep both constants.
- Asset names become `opencode-humanstudy-<platform>-<arch>[-baseline].zip` with `<platform>` being
  `darwin` or `windows` (not `win32`).
- Drop the hard-coded `size` / `sha256` table. Download `SHA256SUMS.txt` from the same release,
  look up the asset's line, and verify the zip against it; take the size from `Content-Length`.
  Trust still rests on the release being published by the HumanStudy-Hub org.
- `opencode --version` prints `opencode-humanstudy <semver>`, so the existing
  `stdout.includes(OPENCODE_VERSION)` post-install check keeps passing with `OPENCODE_VERSION` set
  to the semver.
- The health check is unchanged: `GET /global/health` returns `{"healthy":true,"version":"<semver>"}`
  with basic auth `opencode:<OPENCODE_SERVER_PASSWORD>`.
- `kernel/opencode.ts` no longer needs to inject `provider.humanstudy`, `model`, `small_model`,
  `share`, `autoupdate` or `permission` into `OPENCODE_CONFIG_CONTENT`. It only has to export
  `HUMANSTUDY_DESKTOP_KEY` (and optionally `HUMANSTUDY_HOSTED_BASEURL`, `HUMANSTUDY_SERVER_BYPASS`)
  to the server process. `HUMANSTUDY_HOSTED_MODELS` is not read by the fork.
  Note the fork's default base URL is `https://humanstudy-hub.com/api/desktop/v1`.

## Rebasing onto a new upstream tag

```bash
git remote add upstream https://github.com/anomalyco/opencode.git   # once
git fetch upstream --tags            # the clone is shallow: if `git merge-base` finds nothing,
                                     # deepen with `git fetch upstream --shallow-exclude=<older tag>`
git branch humanstudy-<next> humanstudy
git rebase --onto <next-tag> v1.19.0 humanstudy-<next>   # replays the HumanStudy commits
```

Then: fix conflicts (the likely ones are `packages/opencode/src/index.ts` and
`packages/opencode/src/config/config.ts`), re-run the build, re-check the audit notes in patch 3,
update the "Base" tag at the top of this file, tag the old head `humanstudy-<old>-final`, push
the new branch over `humanstudy` with `--force-with-lease`, and tag `hs-v<next>`. Upstream ships
v1 releases from a `v1` branch (v2.x tags are a separate line, do not rebase onto them). The patch
commits are the ones in `git log v1.19.0..humanstudy` that touch only the files listed here.

Files touched relative to upstream: `HUMANSTUDY.md`, `.github/workflows/release-humanstudy.yml`,
`packages/opencode/src/index.ts`, `packages/opencode/src/temporary.ts`,
`packages/opencode/src/config/config.ts` (two lines), `packages/opencode/src/config/humanstudy.ts` (new).
