# Fractal for Codex

From the checkout: `node install.mjs --codex`. In Codex: `$fractal <intent>`.
Both Code and Research read the live shared spec and axis. The parent plans;
independent children earn their place through a bounded question or artifact.

Installation links this directory to the OS user's `~/.agents/skills/fractal`.
Windows uses a junction without administrator rights; POSIX uses a symlink.
There is no shell dependency, copied spec, generated role catalog or config edit.
The skill path is user-scoped, independent of `CODEX_HOME`. Keep this checkout
in place; its updates are live. `node install.mjs --codex --uninstall` removes
only this checkout's link and retains the checkout and tracker/indexer tools.
An occupied or unrelated destination is an error, including during uninstall.

`node <installed-skill>/runtime.mjs` emits a read-only capability manifest:
version, native home/spec/axis/role paths, and the existing Herdr binding's
availability. It does not initialize a project or start a child. Herdr requires
`HERDR_ENV=1` and the separately installed `herdr-subagents` skill and launcher from
[herdr-interactive-subagents](https://github.com/durdn/herdr-interactive-subagents).
When used, that skill owns lifecycle and permissions. Without Herdr, the parent
can use available native agents; a request for visible tabs needs Herdr.

Code uses the existing tracker/indexer setup. Research uses its project's tools;
the research axis's desk paths are examples, not a Codex prerequisite.
Independent verification remains independent: missing verification is reported.

Check the binding without a model call:

```
node --test codex/*.test.mjs install.test.mjs
node codex/runtime.mjs
```
