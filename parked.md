# Parked

What v0.21 held and three real runs did not pay for: a research review run (31/08/2026,
fourteen agents) and a code day (03/09/2026, four loops, about thirty agents). Each
entry keeps the words as they stood at v0.21, the evidence for parking, and what earns
it back. A line comes back only when a run pays
for it, named in that run's feedback. Nothing here binds an agent.

## The five coordination patterns

> Five coordination patterns: generator-verifier, orchestrator-subagent, agent teams,
> message bus, shared state; the simplest that works, evolved when it struggles.
> pattern: which of the five and why it is the simplest that fits.

Pattern chose orchestrator-subagent in every loop of every run; "which of the five and
why" was a paragraph written and never read. The kernel has one shape. Earns back: a
run that needs a second shape and tries it.

## Grades and the model map

> data Agent = Agent Axis Grade -- grade = runner x model x effort x budget
> a node: -l axis:<A>,grade:<runner>.<model>.<effort>,agent:<id>
> map, set at pattern: scouts, mechanical steps and a worker the light model; pattern,
> verifier and senior the top; light and top are pi gpt-5.6-luna and claude opus under
> cmd/run.sh, sonnet and opus under the Agent tool; the process spawns on the item's
> grade and refuses one above the map with no why.

The map was not followed in any run and nothing came of it; the runs used the agent
frontmatter's models and the principal's directive. The kernel keeps the frontmatter
as the model and an override with its why in the item. Earns back: a headless run
where the process must pick a model per item.

## The headless process: ready, holds, restart words, cmd/loop.mjs

> run = map loop . ready -- a process
> ready is a fired trigger, not a queue: a dependency settled, a time came, a crash
> with budget left. A spawn's restart word: permanent for a hold, transient for a
> worker, temporary for a scout or an observer.
> when = at <iso> or every <minutes>, and the process arms what is due; bd ready;
> continuous: node cmd/loop.mjs [--once] [--max n] [--every s] [--dry-run]
> headless: cmd/run.sh [-p provider] pi|claude <model> <budget-min> <cwd> [task]

No unattended loop has run. Every real loop had a session as the process, spawning
through the Agent tool. `cmd/loop.mjs`, its tests and fixtures are deleted at v0.22.
`cmd/run.sh` stays in the tree because pi's `fractal_run` tool calls it; the axis no longer binds it. The one part of `ready` a run used, a
scout item blocking pattern's item, is in the kernel as a sentence. Earns back: a loop
wanted overnight or from holds, with nobody watching.

## diverge

> diverge :: Intent -> [Plan] -- senior, on ask; a new shape
> at pattern or judge; each names the shape replaced and the cost; one enters only as
> a later loop's intent

Never asked for in three runs. Earns back: a loop where the plan's shape fails and a
senior proposes another.

## cut

> cut :: Step -- senior; real waste out
> cut = remove (5..10% of added) -- a commit that only removes; under 5% found, record
> the count and stop; a removed test fails at judge

On the code day cut found one duplicated docstring paragraph and recorded that the
meter counts docstrings as zero. The senior's removal is now the second half of
reduce, as its own commit, with no quota. Earns back: a run where a separate removal
pass finds what reduce did not.

## The meta axis, its checker and the observer

`parked/meta-axis.md` holds the file verbatim. `dag/check.py`, its tests and README
are deleted at v0.22.

The meta axis governed the spec's own cycles: the observer, the checker's rules R1
to R11, the cold baseline. No code loop ran it; the value came from reading the
feedback, not from checking its own tree. The spec is frozen at v0.22: no spec cycle
without a run that pays for the line. Earns back: the spec running loops on itself
again, with a checker a cycle actually reads.

## The indexer rule

> indexer first: the touched symbols and their callers before the first edit
> class Indexer where init, index, callers, callees, impact, query
> instance Indexer = codegraph 1.6.0 -- MCP codegraph_explore when it is in the tool
> list, else the CLI

No report names it, for or against. The tool stays installed by `init.mjs` and
`install.mjs` and a worker may use it; the rule is gone. Earns back: a run that shows
an edit the indexer would have caught.

## The bus

> class Bus where post, read -- agent teams, message bus and shared state all run on it
> instance Bus = Tracker -- bd comments <id> reads what bd comment posted

The three patterns it served are parked above. Comments on items stay as the record.

## Tracker metadata nobody read

> metadata ... failure_from when restart; bd update <id> --defer <iso>; --set-metadata
> when="every <n>"; the process arms both with -s open --assignee ""

Fields of the headless process. The kernel's metadata is artifact, failure, claims,
pid, spent.
