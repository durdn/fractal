# fractal

Fractal is an agent framework: a spec in types, and a loop that runs an intent
through agents. The session plans by default, delegates independent work,
and judges the evidence. A planning child is optional. The
smallest plan is work and judge; verify, enforce and reduce join it when the
intent says why. Tools are reached through interfaces, so any one of them can be
replaced. Three real runs cut it to this kernel; what they did not pay for is in
`parked.md`.

## Install

    git clone <this repo>
    cd fractal
    node install.mjs

One install, on a blank box. It puts the tracker and the indexer on the path
if they are missing, then deploys fractal into the harnesses it finds. No admin
rights. Deployment flags can be combined; `--uninstall` removes selected deployments.

| Runtime | Select | Global deployment | Runner |
|---|---|---|---|
| Claude Code | `--claude-code` | `~/.claude/skills/fractal`, five agents | Agent tool; nothing else to install |
| pi | `--pi` | Local pi package, five global agents | the `subagent` tool of a pi subagent extension, see Requirements |
| Codex | `--codex` | `~/.agents/skills/fractal` | native Codex agents; visible Herdr tabs when herdr-interactive-subagents is installed |

`--codex` also installs for app-only Codex. It links this checkout using a Windows
junction or POSIX symlink; no shell, package dependencies or Codex config edits.
Keep the checkout in place. Existing unrelated skill paths are refused.
Codex's [user skill discovery](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)
supports this global directory and linked folders. See [codex/README.md](codex/README.md).

## Requirements

Node 20 or later and git. `install.mjs` adds the tracker,
[beads](https://github.com/steveyegge/beads), and the indexer,
[codegraph](https://github.com/colbymchenry/codegraph), from npm when they are missing.
The code axis's meter, [lizard](https://pypi.org/project/lizard/), is installed by hand.
Per runtime:

- Claude Code: nothing else. The Agent tool runs the children.
- pi: a pi extension that registers the `subagent` tool. Fractal is built and tested
  against [herdr-interactive-subagents](https://github.com/durdn/herdr-interactive-subagents),
  which runs each child in a [Herdr](https://herdr.dev) tab. Without one, `/fractal` still
  runs: the session is the process and `fractal_run` is the headless runner.
- Codex: nothing else; children are native Codex agents. herdr-interactive-subagents inside
  Herdr adds visible tabs; the skill's runtime reports whether it found them.

## Run

In any repo, in Claude Code or pi:

    /fractal <what you want done>

The first run readies the tracker and the indexer in that repo. There is
nothing else to set up and no tool to learn.

In Codex, use `$fractal <what you want done>` or select Fractal in the skills
menu. Restart the harness if the newly installed skill does not appear.

## Where things live

- `spec.md`, under 1000 characters, is the whole framework
- `code-axis.md` and `research-axis.md` bind it to an axis, one file each; `parked.md` holds the rest
- `roles/` holds the five role bodies, shared by every harness; each says only: read the two files
- `claude-code/`, `pi/` and `codex/` are the deployments
- `install.mjs` installs; `cmd/` holds the runnable scripts, `init.mjs` among them
