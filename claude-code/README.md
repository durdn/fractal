# fractal

Claude Code skill and agents for the fractal loop: the session plans by default,
delegates independent work and judges the evidence. A lead child is optional. It
needs nothing beyond Claude Code: the Agent tool runs the children.

## Install

    node install.mjs

from the repo root; it runs `install.sh` here. That junctions this folder to
`~/.claude/skills/fractal`, writes one agent per role body into
`~/.claude/agents`, and writes `home.path` beside `SKILL.md` so the skill reads
the live spec. Restart Claude Code after. `--help` lists the flags.

## Files

- `SKILL.md` -- the `/fractal` launcher: home, the two files, you are the process
- `install.sh`, `enforce.sh` -- install, and the commit-msg hook the axis names
- `deny.mjs` -- the box's deny list into the user settings, by hand: `find /` and a kill by name, for every agent; a session's own write of settings is refused by the classifier

Every agent reads two files: `spec.md` and the axis it
works on, from the home. The axis file carries the steps, who does what, and
this box's tool bindings in its tail. The five role bodies in the home's
`roles/` say only that; `install.sh` puts this harness's frontmatter on each.
