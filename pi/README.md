# fractal-pi

A pi package that runs the fractal agent loop. It ships a `/fractal` command, a
`fractal_status` tool, a `fractal_run` tool, a `/fractal-install` command, and five
agent roles: scout, worker, verifier, senior, lead. The session plans by default and
delegates independent work through the session's `subagent` tool with a model, budget
and reply shape. A lead child is optional when decomposition is uncertain or a plan
challenge is requested.

The `subagent` tool comes from a separate pi extension. Fractal is built and tested
against [herdr-interactive-subagents](https://github.com/durdn/herdr-interactive-subagents),
which runs each child as a pi session in a [Herdr](https://herdr.dev) tab. This package
installs beside it; it does not fork it and does not need it to load. Without such an
extension `/fractal` still runs: the session is the process, `fractal_run` starts a
headless pi or Claude child through `cmd/run.sh`, and no visible children appear.

## Install

From the repo root:

```
node install.mjs
```

That puts the tracker and the indexer bindings on the path if they are
missing, then runs `pi install` on this package. `--pi` picks this deployment
alone.

The role bodies are shared with every other harness and live in the home's
`roles/`, one file per role, with no frontmatter of their own. Installing
composes each with pi's frontmatter, held in `extension/roles.ts`, and writes
the five into your global pi agent directory,
`${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents/`. The subagent extension discovers
roles only from the project's `.pi/agents/`, that global directory, or its own
bundled roles; a package has no other way to contribute a role. A failed sync is reported in
the session, not swallowed; `/fractal-install` retries it.

## Example run

```
$ pi
> /fractal add input validation to the signup form
```

The session becomes the loop's lead. Before the lead prompt exists, the
`/fractal` handler runs `cmd/init.mjs` on the session's directory: that is the
init op on the tracker and the indexer, and it is the only setup a repo needs.
A binding it cannot find is reported in the session, and the run stops there.

The parent selects the steps the intent needs and delegates bounded items,
each with its grade, budget, reply shape and home. Independent verification
stays separate from authorship. A finding becomes the next intent within the
remaining budget; it does not silently widen the current task.

## What the code does for children

The spec reaches every child by code, not by a lead remembering to paste it. A
`tool_call` hook watches the `subagent` tool: a `fractal-` lead or senior
gets `spec.md` and `code-axis.md` prepended verbatim and whole; a scout, worker
or verifier gets the axis alone, which holds the lines that bind its step. It
prepends nothing twice, and a home it cannot resolve leaves the spawn alone
rather than blocking it.

Tracker items carry the fields of the Tracker interface in `code-axis.md`,
never prose. That is what `fractal_status`
prints as a tree with over-budget items flagged.
