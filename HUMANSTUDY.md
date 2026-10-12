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
