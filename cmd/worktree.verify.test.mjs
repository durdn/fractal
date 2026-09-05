// cmd/worktree.verify.test.mjs: the gaps found verifying cmd/worktree.mjs
// (fractal-mw4.2.2). Two behaviors the suite claims but does not test: land
// leaves no rebase in progress after a conflict, and the tool works when cwd
// is a linked worktree rather than the repo root.
// usage: node --test cmd/worktree.verify.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { add, drop, land, list } from "./worktree.mjs";

const dirs = [];

function run(args, cwd) {
	const r = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
	return r.stdout;
}

function repo() {
	const dir = mkdtempSync(join(tmpdir(), "fractal-wt-verify-"));
	dirs.push(dir);
	run(["init", "-b", "master"], dir);
	writeFileSync(join(dir, "a.txt"), "base\n");
	run(["add", "."], dir);
	run(["commit", "-m", "init"], dir);
	return dir;
}

function commit(cwd, file, content, message) {
	writeFileSync(join(cwd, file), content);
	run(["add", "."], cwd);
	run(["commit", "-m", message], cwd);
}

// why: `git status --porcelain=v1` never prints the word "rebasing" - mid-rebase
// it prints `UU <file>` and nothing else - so the existing suite's check for it
// cannot fail. The state git actually keeps is the rebase-merge directory.
function rebaseInProgress(cwd) {
	const dir = run(["rev-parse", "--git-path", "rebase-merge"], cwd).trim();
	const apply = run(["rev-parse", "--git-path", "rebase-apply"], cwd).trim();
	return existsSync(join(cwd, dir)) || existsSync(join(cwd, apply));
}

afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("land, after a conflict", () => {
	test("aborts the rebase: no rebase in progress, the branch tip is back on its own commit", () => {
		const dir = repo();
		const target = add("w1", dir);
		commit(target, "a.txt", "from branch\n", "branch change");
		const branchTip = run(["rev-parse", "w1"], dir).trim();
		commit(dir, "a.txt", "from master\n", "master change");
		assert.throws(() => land("w1", dir), /a\.txt/);
		assert.equal(rebaseInProgress(target), false, "the worktree is still mid-rebase");
		assert.equal(run(["rev-parse", "HEAD"], target).trim(), branchTip, "HEAD is not back on the branch commit");
		assert.equal(run(["branch", "--show-current"], target).trim(), "w1", "the worktree is left detached");
		// and the worktree is left clean and usable, not holding conflict markers
		assert.equal(run(["status", "--porcelain=v1"], target).trim(), "", "the worktree was left dirty");
	});
});

describe("cwd is a linked worktree, not the repo root", () => {
	test("list, land and drop find the root from inside a worktree", () => {
		const dir = repo();
		const one = add("w1", dir);
		const two = add("w2", one); // add, called from inside w1
		assert.ok(existsSync(two), "add from inside a worktree did not create w2");
		assert.equal(list(two).length, 3, "list from inside a worktree missed one");
		commit(two, "b.txt", "added\n", "feature");
		land("w2", two); // land the worktree we are standing in
		assert.equal(run(["log", "--oneline", "master"], dir).trim().split("\n").length, 2);
		drop("w1", dir);
		assert.ok(!existsSync(one));
	});
});
