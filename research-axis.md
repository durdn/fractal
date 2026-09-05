# Research axis

The words of `spec.md`, bound to research: a sourced idea becomes a sealed verdict in the catalogue. The tail holds example bindings; deployments select the runtime.

```haskell
type Delta  = Catalogued  -- the spec, the book, the battery, the verdict: what the loop leaves in the catalogue
type Intent = Item        -- claims and an estimate in minutes required, the rest optional; the prompt is the body, never restated in fields
type Claim  = Path | Name -- a source account, a broker session, a data root: one holder at a time
type Budget = Minutes

pattern = item [which, why, steps, claims, budgets, floors, estimate]  -- before outcomes are read
  -- memory first: the axis's closed items; an idea already closed does not reopen and its reason stands
  -- floors and inference assumptions fit the question and data; freeze the finite candidate family before outcomes
  -- one signal, one intent: restatements are variants on the item
  -- steps: verify always; enforce and reduce when a book was built; the order is enforce, verify, reduce: the seal before the null
  -- a review or design: short claims with evidence and uncertainty; the smallest discriminating experiment and what it defers; proposed constants are not findings; the parent adopts or rejects scope by name

work = spec `or` book `or` review  -- one item per task
  -- a spec: every rule, parameter and performance claim cites its source in the same paragraph; what the source does not state is `unspecified`, never a guess
  -- a claimed number is quoted with its sample and cost assumption, never as measured
  -- a book: its own claim, the runner's interface, clock and bars; no precomputed features; a rule needing the deciding bar is an honest variant, named in the item
  -- a review: existing ledgers, existing parameters, scored against floors; a parameter changed mid-review is a new intent
  -- a numeric review is an audit: population, source closure, timestamp meaning and output identity named before its first pass

verify = null `then` real  -- not by the author, not by whoever built the book
  -- choose the null and uncertainty method before outcomes; resampling must justify its dependence assumptions, not follow a universal ritual
  -- a cold reader opens the cited source for the entry rule and the exit rule and says what it found there
  -- a run that emits a number runs twice and diffs, a difference is a finding
  -- challenge named decisions and native accounting with counterexamples; a battery without a failure threshold is not a verify
  -- a finding after green is its own verify on the sealed artifacts; the old record keeps its narrowed scope

enforce = seal  -- hooks, no judgment
  -- preflight the executable imports and the serialization round-trip across the run/replay boundary on one production-shaped input before a full run
  -- seal the candidate family, parameters, sources, inputs, parent baseline and eras before outcomes; the source closure is what the run loads, derived, never a hand list; refuse altered inputs, retain failed attempts and distinguish diagnostics from candidates
  -- progress carries no outcome; the numbers open after verify, at judge
  -- costs and slippage on every entry, never flattering
  -- a parameter changed after the seal is a new intent with a new seal, and it does not read the verdict block

reduce = numbers `then` senior  -- the same battery columns per era, beside pattern's floors; a parameter the source does not state comes out, or the item says why it stays

judge = Accept | Fail step why | Stop why
  -- Accept, a spec: the cold reader confirms sourced entry/exit rules and floors; nothing unstated is cited; it opens the book
  -- Accept, a book: the registered gates hold after full costs and declared uncertainty; it opens a Code port that replays the sealed book session for session. Its card is not armed: live deployment is the principal's call on evidence beyond one loop
  -- Fail: record the finding or crash; retry within the budget with its own pattern and claims
  -- Stop: record the unmet floor and close; the reason is memory
  -- a close carries the verdict and the next falsifier; that is the next run's memory

-- who
pattern  -- parent by default, memory first; a planning child spawns nothing; the parent judges the cold read, seal and battery
scout    -- reads sources; facts and where they are; "the source does not say it" over a guess
worker   -- work.   verifier -- verify: the null and the cold read.   senior -- reduce

class Tracker where create, claim, comment, close, show, list
  -- an item's metadata: artifact failure claims
class Runner  where start, stop
class Hooks   where seal, verify, status
class Meter   where battery  -- comparable columns per era, with the declared null and uncertainty

-- bindings, this box
instance Tracker = bd 1.2.2  -- memory: bd list --json -s closed -l axis:Research --sort closed -n 20; a pulled export is not in the store until bd import .beads/issues.jsonl
  -- if empty, drop -l and match titles/paths or the supplied restart documents; no label match does not mean no memory
instance Runner  = Agent tool  -- the home is the desk the item names; a reported spawn is stopped before the next step; a killed spawn batch is followed by the runner's own agent list, for orphans
instance Hooks   = <desk>/cmd/seal.py <slug> --params <path>; eras.py --ledger <path>; spec_status.py <slug> <status>  -- example names; a desk binds its own seal, battery and status tools
instance Meter   = the desk's per-era battery; use the project's declared inference method
homes    = <spec-home> for a spec, <desk> for a book and its port; the catalogue is the tracker
```
