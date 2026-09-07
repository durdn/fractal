# Fractal agent framework

v0.26, 07/09/2026. Not Haskell: a shared notation. Planning and reduction read this and the axis verbatim; scouts, workers and verifiers take the axis lines for their step verbatim. A spawn is an item and the home; its deliverable ends the work, not a progress message. The process owns what outlives it. A claim is a path or an exclusive resource: account, key, session, process, data root. Read the clock at judge, never poll or guess it; prompts carry minutes, not a time of day. The parent plans by default; a planning child earns its place through uncertain decomposition or a requested challenge; an owner child is the process of a disjoint slice, with its own budget and claims, and returns a verdict. A child's name is the authority it holds. User scope governs the steps, and a floor names its author: the user's mandate, a validity condition, or the lead's own screen, which is a proposal until the principal takes it. Tools are classes, with defaults in the axis and runtime overrides in the deployment. Real runs earn changes; unearned machinery stays in `parked.md`.

```haskell
data Axis = Code | Research
data Verdict = Accept | Fail Failure | Stop Reason -- a Fail is the next intent, with its facts; a Stop has none
data Claim = Path | Name
type Step = Delta -> Delta -- artifact in budget, or a crash

loop = judge . steps . work . pattern -- the process runs it; a settled dependency fires the next

pattern :: Intent -> Plan -- parent, memory first; items, claims, budgets
steps   :: Plan -> Step -- in the axis's order; none is plain
memory  :: Axis -> [Intent] -- closed items; empty labels fall back to titles/paths
work    :: Plan -> Delta -- workers, one per item
verify  :: Step -- not by the author; the intent measured, red, then green
enforce :: Step -- hooks, no judgment
reduce  :: Step -- senior; numbers, then what intent does not need comes out
judge   :: Delta -> Verdict -- the record decides, never the report
```
