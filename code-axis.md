# Code axis

Not Haskell. The words of `spec.md`, bound to code. The tail is this box's bindings; another box edits only the tail.

```haskell
type Delta  = Diff    -- everything the loop commits: one branch, linear, rebase and --ff-only
type Intent = Item    -- budget, claims and step are its fields, never prose in a task
type Claim  = Path | Name -- a file; or one holder at a time of a process by its pid tree, a key by name:<key>:<verb>, a session; the tracker's claim is the holder
type Budget = Minutes

pattern = item [artifact, why, steps, claims, budget, thresholds]  -- before any code
  -- memory first: the axis's last closed items, and the home's own rules where it keeps them
  -- one worker per item; two at once only on disjoint claims, and a file the wave creates is claimed by one
  -- steps: verify unless no behavior changes; reduce when a Fail came before, or the estimate is over one writer's budget; enforce at every commit; the order is verify, reduce
  -- a work item opens with the artifact and its path; then whether it commits and the subject, the run and its numbers, the close; the facts to gather come after
  -- a key is a Name claim with its verb, in env, in a file the process checks is ignored before the first spawn; no agent prints, logs, copies or commits it; an order verb is a claim the principal grants
  -- a scout it needs is an item under its own that blocks it; the process runs it and fires pattern again
  -- a tool the box lacks is a gap in the item, never a silent substitute

work = artifact `in` files  -- one item per task, in its worktree
  -- no new dependency without a yes in the item; a writer commits only when its item says so; a writer short of a path stops and says so
  -- the writer claims its item when it starts, comments, closes; stops at budget; its report is a comment on the item, its reply a pointer to it
  -- everything in the foreground: no background task, no long-lived process, a call over two minutes with its timeout; a runaway child is a crash to report, not minutes to chase

verify = review `then` failing `then` passing  -- not by the author, not by the senior who repaired
  -- review: the intent measured off the record, each threshold a number in the item; a live source: a count per source and the age of its last record, before any parity
  -- a run that emits a number runs twice and diffs, a difference is a finding; a count at a page size or cap is a truncation until shown otherwise
  -- an artifact's test asserts its content, ordered and typed, never that it exists; the committed file carries the number the item named, read there and not in the comment; a key's occurrences are counted across the diff and the record
  -- failing: a command and its output in the item before the change; an edited test is not a run; a test that asserts nothing, mocks the unit or cannot fail is not written, or deleted and not counted
  -- the whole suite passes; what was broken before is the loop's to fix, or named in the item as larger than the task

enforce = hooks [format, lint, types, rules]  -- on every commit; rules: the subject `type: item: message`, type in feat fix maint log doc spec port; every staged path in the item's claims; a Name claim held on the tracker, not in the diff
  -- a skipped or overridden hook: the step did not run

reduce = numbers `then` senior  -- the meter over the diff beside pattern's thresholds; the senior over threshold first, then what intent does not need comes out as its own commit; no metric rises, the suite passes unchanged; a removed test fails at judge

judge = Accept | Fail step why | Stop why  -- the process reads the record, never the report: the tape, the committed file, the process tree
  -- Accept: suite green, every hook passed, no metric over threshold, verify accepted, nothing running outside a Name claim
  -- Fail: verify's finding or a crash past budget, named in the item with its facts; run with the budget left, its own pattern and claims
  -- Stop: the budget is out; close with the reason, which is memory

-- who
pattern  -- parent by default, memory first; a planning child spawns nothing; an owner child is the process of its slice
scout    -- reads; never writes, never mutates; facts it checked and where; "not there" over a guess; its item is step:pattern, by:<scout>
worker   -- work.   verifier -- verify.   senior -- reduce; each in the foreground, exiting with nothing running
process  -- the session, or an owner child over its slice: plans, delegates independent items, collects deliverables, manages Name claims and worktrees, judges the evidence; a planning child receives corrected facts, scope lands at judge or after a stop

class Tracker where create, claim, comment, close, show, list
  -- an item: an estimate in minutes; metadata artifact failure claims pid spent
  -- memory: closed axis items, newest first; the planner reads them
class Runner  where start, stop
class Hooks   where run
class Meter   where run

-- bindings, this box
init = node <home>/cmd/init.mjs .  -- once per project: tracker, indexer, and core.hooksPath to the home's cmd/hooks

instance Tracker = bd 1.2.2
  -- bd create "title" -t task --parent <id> -l step:<s>,by:<agent> --estimate <min> --metadata '{"claims":["a.py","name:the-broker-session"]}' --no-inherit-labels
  -- a node: -t epic -l axis:<A>,agent:<id>; labels inherit, so every step item takes --no-inherit-labels
  -- bd update <id> --claim | -s in_progress | --set-metadata k=v for a scalar | --metadata '{...}' for a list; bd comment <id> "..."; bd close <id> -r "..."; bd dep <a> --blocks <b>
  -- memory: bd list --json -s closed -l axis:Code --sort closed -n 20; if empty, drop -l and match titles/paths or the supplied restart documents; pass ids; retry a lock once

instance Runner = Agent tool  -- fractal-scout, fractal-worker, fractal-verifier, fractal-senior; fractal-lead plans, without the Agent tool; no role here holds it, so on this box the session is the only process and an owner child needs a runner that nests, named in the item; /fractal <intent> makes the session the process of one loop
  -- the model is the frontmatter's: scout and worker sonnet, lead, verifier and senior opus; an override carries its why in the item
  -- the home: node cmd/worktree.mjs add <item> before the spawn, a sibling of the checkout at its depth, <repo>--<item>, a branch per item; one writer commits in a worktree at a time; the process lands it at judge, land <item>, or drops it on a Fail; bd from a worktree reaches the root's tracker
  -- a finished spawn wakes on the exit of a background task it left, on stale context; a reported spawn is stopped before the next step, except a verifier that failed: the fix comes back to it by message, re-verified on the figures it holds, and it is stopped at judge; a killed spawn batch is followed by the runner's own agent list, for orphans
  -- a Name claim on a process: the pid tree, taskkill /T /F /PID <pid>, allowed in settings before the loop or a gap in the item; a venv python.exe is a launcher over the interpreter, so its pid alone stops nothing
  -- this box denies in settings, for every agent, find / and a kill by name: taskkill /IM, Stop-Process -Name, pkill, killall; a worker searches with Glob and Grep, repo-rooted

instance Hooks = <home>/cmd/hooks/commit-msg, wired by init  -- per repo: a home with its own hooks keeps them and its convention governs, named in the item; node cmd/enforce-writes.mjs runs enforce's rules: a refusal names the shape it wants; a parent's claims count, .beads/*.jsonl always, a Name claim is skipped, no claims up the chain passes with a note that paths went unchecked; plus the language's formatter, linter, type checker
instance Meter = lizard 1.24.0, node cmd/meter.mjs --base <commit> --ccn 10  -- exit 1 over threshold; js and mjs: lizard folds functions, read a number over threshold there by hand; shell gets sh -n and a line count; markdown skipped and named
```
