# CLAUDE.md

Fractal is a spec in types and a loop that runs an intent through agents. This file is for a session working on this repository with Claude Code.

## Voice

Short paragraphs. Brief, clean sentences. Core ideas only. Plain words. Show the artifact, say what changed, stop. No process ceremony, no capitalized phase names as jargon. If a page reads like bureaucracy, it is wrong.

## Spec

`spec.md` holds the spec as types, under 1000 characters. `code-axis.md` and `research-axis.md` hold the bindings. `parked.md` holds what real runs did not pay for; a run earns a line back. Frozen: no spec change without a run that pays for the line. Occam's razor governs. `cmd/enforce-spec.sh` is the mechanical check on the spec; run it before a spec commit.

The spec is used, never rephrased. Whoever plans or reduces gets `spec.md` and the axis file verbatim, plus the mission and the bindings; a scout, worker or verifier gets the axis lines that bind its step, verbatim. A lead that paraphrases the spec into prose has broken the loop.

## Repository

- `roles/`: the five role bodies, shared by every harness.
- `claude-code/`, `pi/`, `codex/`: the deployments. `install.mjs` installs them.
- `cmd/`: the runnable scripts; `init.mjs` readies a repo, `enforce-writes.mjs` is the commit hook, `meter.mjs` the meter, `worktree.mjs` the worktrees.
- Commits: `type: item: message`, type in feat fix maint log doc spec port; `node cmd/init.mjs .` wires the hook that checks it.

## Cold start

Read, in this order, and nothing else before acting: this file; `spec.md`; the axis you work on. Then the memory, which is the tracker, not a file: the axis's last closed items, `bd list --json -s closed -l axis:<A> --sort closed -n 20`.

## Failure modes seen, do not repeat

- Paraphrasing the spec into prose for an agent. Hand the file.
- Prose reports about "Steps" and "Phases". Show the artifact, say what changed.
- Widening a step while it runs. A judge fails a step; it does not enlarge one.
- Sending orders into a running loop. Orders land at judge or after a stop.
- Doing the reading and the work instead of coordinating. Scouts read; workers work; the record decides.
- Letting a step run without a budget or an artifact. Cut it off; log it.
- A session polling the clock while it waits. Wait on notifications; check budgets at step boundaries. Read the clock at judge.
- A verifier bending a test to see red. The failing run is a recorded command output.
- The loop's records shipped inside the deliverable. Records go to the tracker items.
