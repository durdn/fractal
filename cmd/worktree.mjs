#!/usr/bin/env node
// cmd/worktree.mjs: a worktree per writer. add makes one on a new branch from
// master, a sibling of the checkout at its own depth, <repo>--<item>; land rebases it onto master and fast-forwards master, then removes
// it; drop discards it; list shows them. Runs from the repo root or from any
// worktree of it. Node, no dependencies; git is the only binding.
//
// usage: node cmd/worktree.mjs add|land|drop|list [item] [--force]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// why: same Windows-safe shape as run() in init.mjs (a .cmd shim needs cmd.exe,
// args stay an array so cmd.exe quotes each itself), but this one never throws:
// land and drop both need to read a failing git call's stderr before acting.
function spawnGit(args, cwd) {
	const opts = { cwd, encoding: "utf8", shell: false };
	const r =
		process.platform === "win32"
			? spawnSync("cmd.exe", ["/c", "git", ...args], opts)
			: spawnSync("git", args, opts);
	if (r.error) throw r.error;
	return r;
}

function git(args, cwd) {
	const r = spawnGit(args, cwd);
	if (r.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
	}
	return (r.stdout ?? "").trim();
}

// why: the common git dir is the one thing shared by the main checkout and
// every linked worktree; its parent is the repo root, whichever of them cwd
// sits in.
function findRoot(cwd) {
	const commonDir = git(["rev-parse", "--git-common-dir"], cwd);
	return dirname(resolve(cwd, commonDir));
}

// why: a sibling at the checkout's depth, so a script that resolves a path against the
// repo's parent (`parents[N]`, `../sibling-repo`) finds the same thing from a worktree.
// The old `<repo>-wt/<item>` sat one level deeper.
const wtPath = (root, item) => resolve(dirname(root), `${basename(root)}--${item}`);

// why: one parse of `worktree list --porcelain`, the only place the blocks
// (blank-line separated, "key value" lines) get read.
function worktrees(root) {
	const out = git(["worktree", "list", "--porcelain"], root);
	return out
		.split(/\r?\n\r?\n/)
		.filter(Boolean)
		.map((block) => {
			const lines = block.split(/\r?\n/);
			const path = lines.find((l) => l.startsWith("worktree "))?.slice("worktree ".length);
			const branchLine = lines.find((l) => l.startsWith("branch "));
			const branch = branchLine ? branchLine.slice("branch refs/heads/".length) : null;
			return { path, branch };
		});
}

function branchExists(name, root) {
	return spawnGit(["rev-parse", "--verify", "--quiet", `refs/heads/${name}`], root).status === 0;
}

export function add(item, cwd = ".") {
	const root = findRoot(resolve(cwd));
	const target = wtPath(root, item);
	if (existsSync(target)) throw new Error(`worktree path exists: ${target}`);
	if (branchExists(item, root)) throw new Error(`branch exists: ${item}`);
	git(["worktree", "add", "-b", item, target, "master"], root);
	return target;
}

export function land(item, cwd = ".") {
	const root = findRoot(resolve(cwd));
	const wt = worktrees(root).find((w) => w.branch === item);
	if (!wt) throw new Error(`no worktree for branch: ${item}`);
	const rebase = spawnGit(["rebase", "master"], wt.path);
	if (rebase.status !== 0) {
		const conflicts = git(["diff", "--name-only", "--diff-filter=U"], wt.path);
		spawnGit(["rebase", "--abort"], wt.path);
		throw new Error(conflicts || (rebase.stderr || rebase.stdout || "").trim());
	}
	git(["merge", "--ff-only", item], root);
	git(["worktree", "remove", wt.path, "--force"], root);
	git(["branch", "-d", item], root);
	return git(["rev-parse", "master"], root);
}

export function drop(item, cwd = ".", force = false) {
	const root = findRoot(resolve(cwd));
	const wt = worktrees(root).find((w) => w.branch === item);
	if (!wt) throw new Error(`no worktree for branch: ${item}`);
	if (!force) {
		const count = Number(git(["rev-list", "--count", `master..${item}`], root));
		if (count > 0) throw new Error(`branch ${item} has ${count} commit(s) not on master; use --force`);
	}
	git(["worktree", "remove", wt.path, "--force"], root);
	git(["branch", "-D", item], root);
}

export function list(cwd = ".") {
	const root = findRoot(resolve(cwd));
	return worktrees(root).map((w) => `${w.path} ${w.branch ?? "(detached)"}`);
}

// why: the module is imported by its own test, so the CLI half only fires
// when node was pointed at this file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [cmd, item, ...rest] = process.argv.slice(2);
	const force = rest.includes("--force");
	try {
		switch (cmd) {
			case "add":
				console.log(add(item));
				break;
			case "land":
				console.log(land(item));
				break;
			case "drop":
				drop(item, ".", force);
				break;
			case "list":
				for (const line of list()) console.log(line);
				break;
			default:
				throw new Error("usage: worktree.mjs add|land|drop|list [item] [--force]");
		}
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
