#!/usr/bin/env node
// cmd/init.mjs: ready one repo for the loop. Initializes the tracker and the
// indexer through their bindings, wires the commit-msg hook, once each, and
// prints one line per interface. Node, not sh: a blank Windows box may have no Git Bash, and node
// is required anyway.
//
// usage: node cmd/init.mjs [repo]   (default: the current directory)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// why: the commit-msg hook lives in the fractal home, and git reads core.hooksPath per repo,
// not per box; the wire is init's, once per repo (cycle 003, defect 2).
const HOOKS = join(dirname(fileURLToPath(import.meta.url)), "hooks");

function gitOut(args, cwd) {
	const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
	return r.status === 0 ? (r.stdout ?? "").trim() : null;
}

// why: a Windows .cmd/.bat shim, which is how both bindings arrive, cannot be exec'd
// directly; it must run through cmd.exe. Args stay an array on both branches so cmd.exe
// quotes each one itself: no shell:true, no string join, no injection surface. Same shape
// as runBin in pi/extension/types.ts; cmd/ owns its own copy so it imports no harness.
export function run(cmd, args, cwd) {
	const opts = { cwd, encoding: "utf8", shell: false };
	const r =
		process.platform === "win32"
			? spawnSync("cmd.exe", ["/c", cmd, ...args], opts)
			: spawnSync(cmd, args, opts);
	if (r.error) throw r.error;
	if (r.status !== 0) {
		throw new Error(`${cmd} ${args.join(" ")} failed: ${(r.stderr || "").trim() || r.status}`);
	}
	return r.stdout ?? "";
}

// why: asking the binding for its version to see whether it exists costs a process and
// reports a missing binding as a crash. PATHEXT is the same list cmd.exe itself resolves.
export function onPath(bin) {
	const exts = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD").split(";") : [];
	for (const dir of (process.env.PATH ?? "").split(delimiter)) {
		if (!dir) continue;
		for (const ext of ["", ...exts]) if (existsSync(join(dir, bin + ext))) return true;
	}
	return false;
}

// why: one row per interface, the binding named once. A replacement tool changes this row
// and nothing else, which is the whole point of reaching a tool through an interface.
const INTERFACES = [
	{
		name: "tracker",
		binding: "beads",
		bin: "bd",
		// why: --init-if-missing is beads' own idempotence; the marker keeps a second run
		// from touching the binding at all. export.auto keeps .beads/issues.jsonl current,
		// and that file is the record every reader shares.
		ready: (repo) => existsSync(join(repo, ".beads")),
		steps: (repo) => [
			{
				args: ["init", "--skip-agents", "--skip-hooks", "--non-interactive", "-q", "--init-if-missing"],
				cwd: repo,
			},
			{ args: ["config", "set", "export.auto", "true"], cwd: repo },
		],
	},
	{
		name: "indexer",
		binding: "codegraph",
		bin: "codegraph",
		// why: init builds the whole index, so it runs once and the marker guards it. -y
		// because a script has no one to answer a prompt. Harmless with nothing to index.
		ready: (repo) => existsSync(join(repo, ".codegraph")),
		steps: (repo) => [{ args: ["init", repo, "-y"] }],
	},
	{
		name: "hooks",
		binding: "git",
		bin: "git",
		done: "wired",
		skip: (repo) => (gitOut(["rev-parse", "--git-dir"], repo) === null ? "not a git repo" : null),
		ready: (repo) => gitOut(["config", "--get", "core.hooksPath"], repo) === HOOKS,
		steps: (repo) => [{ args: ["config", "core.hooksPath", HOOKS], cwd: repo }],
	},
];

export function initOne(iface, repo) {
	if (!onPath(iface.bin)) {
		throw new Error(`${iface.name}: no ${iface.binding} binding on the path. Run: node install.mjs`);
	}
	const skip = iface.skip?.(repo);
	if (skip) return `${iface.name}: skipped (${skip})`;
	if (iface.ready(repo)) return `${iface.name}: ready (${iface.binding})`;
	for (const step of iface.steps(repo)) run(iface.bin, step.args, step.cwd);
	return `${iface.name}: ${iface.done ?? "initialized"} (${iface.binding})`;
}

export const initTracker = (repo = ".") => initOne(INTERFACES[0], resolve(repo));
export const initIndexer = (repo = ".") => initOne(INTERFACES[1], resolve(repo));
export const initHooks = (repo = ".") => initOne(INTERFACES[2], resolve(repo));
export { HOOKS };

export function initRepo(repo = ".") {
	const at = resolve(repo);
	return INTERFACES.map((iface) => initOne(iface, at));
}

// why: the module is imported by the pi bindings and run as a command by the skill, so the
// CLI half only fires when node was pointed at this file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		for (const line of initRepo(process.argv[2] ?? ".")) console.log(line);
	} catch (error) {
		console.error(`fractal: ${error.message}`);
		process.exit(1);
	}
}
