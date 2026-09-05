# Meta axis

Not Haskell. The words of `spec.md`, bound to a loop's own record. The tail is this box's bindings; another box edits only the tail.

```haskell
type Delta  = Record   -- the tracker items, the log, the commits: everything the cycle leaves behind
type Intent = Cycle    -- the cycle's item; the root's tree hangs under it
type Budget = Minutes  -- per step; a loop's is the sum of its steps'; tokens and tool uses where the runner meters them

pattern = item [which, why, steps, tree, budgets, claims, estimate]  -- before any loop starts
  -- memory first: the axis's last closed items
  -- which of the five and why it is the simplest that fits
  -- steps: which of verify, enforce, reduce, cut the cycle needs, with why; none named is plain
  -- tree: which loops, runner, grade and restart word per node, each budget, who holds which claim; a hold hangs under the run, above what it fires; what work opens hangs beside, so the fired tree closes and the run does not
  -- estimate: what one plain agent takes on the brief; under 30 minutes the shape is plain

work = loops  -- the process runs them; the session writes the log and nothing else
  -- orders reach a loop at its judge or after a stop; a corrected fact reaches pattern's agent by message
  -- a judge's edit is an edit and goes through enforce like any other

verify = observer record  -- cold, not pattern's agent nor a fork of the session, after every loop with a step named, on the cheapest runner that reads: who ran each step, its artifact, its spend, what a summary hides

enforce = checker tree  -- the cycle's tree, named by --root; one root, pattern first and judge last with work before the rest, verifier not the author, budget, one holder per claim per step at a time, outcome, nothing open at judge, pattern by one agent once, judge by the process; no judgment
  -- the checker follows this file: where they disagree the checker is wrong, and is fixed or dropped

reduce = numbers `then` leaner
  -- numbers: minutes, tokens and tool uses per step beside the budgets, and the cold baseline, one plain agent on the same brief, beside a loop when the shape is new, no step, never estimated
  -- the spend against pattern's estimate says whether the shape was right
  -- leaner: the spec and the axis files, or the cycle failed the tenet

cut = remove added  -- the same files: what the cycle added and the intent does not need comes back out

judge = Accept | Fail step why | Stop why  -- the process reads the record; nothing judges
  -- Accept: the checker passes and the observer found nothing the record contradicts
  -- Fail: the observer's finding or a child's crash past budget, the next intent, run with the budget left; at the root, one such loop per cycle, then stop
  -- Stop: the budget is out; close with the reason

diverge = senior -> [Shape]  -- on the spec, at pattern or judge, when pattern's agent asks; intent kept, shape replaced, cost; one enters only as a later cycle's intent

-- who
root     -- the process over ready: fires each item by its grade, restarts a crash by its word with the budget left, fails the parent past it, sweeps a stopped node's children; the session steers a cycle while one is open
pattern  -- one agent per node, the top grade, memory first; the only agent that plans, and it runs nothing
observer -- verify

class Tracker where export, list  -- the tree for the checker; the axis's closed items for memory
class Runner  where start, list, stop  -- the process lists and stops what it spawned; what it cannot stop keeps its claims
class Hooks   where check  -- the tree's rules; the spec's cap
class Meter   where spend  -- minutes, tokens, tool uses per step

-- bindings, this box
instance Tracker = bd 1.2.2  -- bd list --json --all; memory is bd list --json -s closed -l axis:Meta --sort closed -n 20; the cycle's item is an epic with axis:Meta,grade:,agent:; loops are epics under it
instance Runner  = cmd/loop.mjs over bd ready, the process: cmd/run.sh on each fired item by its grade; restart by the word and the crash's escalation unbuilt as of 30/08/2026; in a session the Agent tool spawns and the session is the process by hand  -- ListAgents at every stop; never TaskOutput on an agent, it floods the caller
instance Hooks   = python dag/check.py [rows.json | -] --root <cycle>; bash cmd/enforce-spec.sh before a spec commit
instance Meter   = the runner's completion report, written to the item: minutes as metadata spent, tokens, tool uses; closed_at minus started_at where no report exists
log      = cycles/NN.md, one per cycle, one writer; stream/directives.md every turn; stream/snags.md as friction lands
```
