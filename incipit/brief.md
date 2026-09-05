# Brief and design notes

The origin, 27/08/2026, kept as history. The spec is the state and has moved on; this file is the intent that started it and the reasoning of the first day, not updated since. Read the spec first, this second. Origin: a notebook page dated 27/08/2026 plus the brief below, worked into the v0.1 spec in a single session on 27/08/2026.

## Original brief (verbatim)

First iteration of a grand design for a recursive fractal agentic framework. every agent has a role (tentative: lead, scout, worker, reviewer) and a mode (continuous, finite). it all starts from a meta-lead origin continuous or finite agent. a lead agent starts its own loop (continuous or finite depending on the level of abstraction). each loop has an axis, tentative axes: meta, goals, process, code. each lead leads/instantiates sub agents across mandatory phases which are modulated through the axis of the lead.

to understand the higher order we present an example: a lead agent assigned to a "code" axis in finite mode MUST instantiate a loop with:

- form an clear decision on which coordination pattern(s) to use with sub-agents to accomplish the goals of the epic: https://claude.com/blog/multi-agent-coordination-patterns
- development/work
- tests (meaningful no theatre)
- automated hooks (coding standards, remove non tagged comments, etc)
- complexity reduction pass using both tools and inference: https://philodev.one/posts/2026-04-code-complexity/
- occam's razor step where one senior party must look for ways to simplify, reduce complexity without counterfeiting the intents (senior agent)
- a lateral thinking senior party that proposes radically different and possibly better ways to accomplish the intents. (senior agent)
- mandatory removal of 5-10% of the code produced removing waste, useless cruft, complexity. It is not allowed to design something with cruft on purpose to have easy removal. we make up for the cuts with lateral thinking new directions.
- the lead is given the result of this loop and can force replaying any step until the quality and the intent of the loop is realized.
- the lead decides the level of smartness and effort of the agent it assigns a step/module to.

the above example will map like a fractal onto higher orders of lead loops. the steps are all present but might not be related to code but related to process, or prose, or content or actions in the real world. the fractal loops might be continuous or finite. there is always a lead that tracks the progress.

the tasks, epics, features, stages are tracked with a skill we use an interface but below the interface for now we use beads by steve yegge. for code indexing we use an interface so we can replace it but for now we use [cut off in the original; later resolved to CodeGraph, colbymchenry/codegraph]

the most important challenge is to pack ALL the above in the most elegant and compact recursive form that an Opus class model on high effort can steer. Some loops will be Fable class but most will be lead by Opus 5 class.

the framework is a specification only for now. we'll tie it to an implementation in later phases.

the elegance is in the compact nature, fractal natura, general approach, make it wonderful and brief. occam's razor rules.

## Notebook page (source sketch)

The brief transcribes a notebook page dated 27/08/2026. Its raw vocabulary, kept here because some of it carries intent the spec doesn't spell out: fractal recursive; crystal; continuous/finite agent; reality, goals, process feeding into axis/code; lead at the center radiating to dev/work, test no theatre, hooks, complexity, occam, lateral; integrate arrow back into lead; must remove 5-10%; meta-lead, chief of staff, top of the pyramid, origin; Pink Floyd Dark Side of the Moon; Mandelbrot tree; decide spawn floor (code).

The Dark Side of the Moon prism (one input refracted into many beams) and the Mandelbrot set (self-similarity at every scale) are the two aesthetic anchors. The spec's opening paragraph references both. Names must nonetheless stay metaphor-less (see Naming below).

## Design notes (assistant meta-remarks, in session order)

**Compression choice.** The whole framework reduces to two objects: a four-tuple agent (role, mode, axis, grade) and a nine-phase loop (Pattern, Work, Verify, Enforce, Measure, Reduce, Diverge, Cut, Judge). The fractal property comes for free from a single rule: recursion lives only inside the Work phase, where a lead may spawn child loops until the spawn floor is reached. Everything else in the brief (meta-lead origin, replay power, 5-10% cut, no-planted-cruft rule) hangs off those two objects as either a lead power or an invariant.

**Grounding.** Phase 1 draws on Anthropic's five coordination patterns (generator-verifier, orchestrator-subagent, agent teams, message bus, shared state), with their own advice baked in: start with the simplest pattern that could work, evolve when it struggles. Phase 5 draws on Sofia Fischer's complexity piece; her conclusion that cognitive complexity can only be judged by the reader is the argument for pairing metric tools with inference rather than trusting metrics alone.

**Deliberate deviation: non-working leads.** The spec gives the lead exactly four powers (choose pattern, assign grade, force replay, set spawn floor) and forbids it from doing the work of its own loop. The brief doesn't say this explicitly, but a lead that also works collapses two levels into one and the self-similarity breaks. Flagged for review; relax it if working leads are wanted.

**Recursion safety.** Two mechanisms, one judgment and one guarantee. The spawn floor is the lead's per-branch judgment call about where delegation stops. The depth budget is the hard guarantee: assigned at spawn, a child gets at most parent minus one, budget zero forbids spawning. Since the budget strictly decreases with depth, infinite nesting is impossible by construction even if a lead's judgment fails. Iterations of a continuous loop stay unbounded by design; nesting does not. Suggested root budget default: 3 or 4, since coordination overhead usually eats the gains below that.

**Indexer caveat.** CodeGraph's own benchmarks show it cuts tokens processed per answer but leaves a substantially larger persistent context footprint per session (one dense verbatim payload that stays in the window, versus many small grep results that get evicted). Irrelevant for finite code loops; continuous loops on the code axis will fill their windows faster and should budget accordingly.

**Naming.** Requirement: metaphor-less, descriptive; FAF rejected as an acronym for its connotation. The fix on the table: swap "framework" for "loops", since the loop is the actual primitive and "framework" describes nothing. Candidates, in preference order as discussed: FAL (Fractal Agent Loops), Oneloop (no acronym, states the thesis, works as a CLI name), RAL (Recursive Agent Loops), FRAL (pronounceable coinage). Rejected on acronym traps or collisions: FAS, RAFT, ALF, AFL, AF. No final decision yet; the spec keeps the descriptive title until one lands.

## Bindings and status

- Tracker: beads (Steve Yegge), behind a skill interface.
- Indexer: CodeGraph (colbymchenry/codegraph), behind an interface, exposed over MCP.
- Spec status: v0.1, specification only. Implementation binds in later phases.
- Open decisions live at the bottom of the spec file: final role set, final axis set, default spawn floor for the code axis, default root depth budget, and whether Verify and Enforce merge on non-code axes.
