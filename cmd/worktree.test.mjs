// cmd/worktree.test.mjs: tests for cmd/worktree.mjs, against real git repos in
// a temp dir. No mocks of git.
// usage: node --test cmd/worktree.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { add, drop, land, list } from "./worktree.mjs";

const dirs = [];

function run(args, cwd) {
	const r = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
	return r.stdout;
}

// why: one commit on master, nothing else, is all any test below needs.
function repo() {
	const dir = mkdtempSync(join(tmpdir(), "fractal-wt-repo-"));
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

afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("add", () => {
	test("makes a worktree on a new branch from master, prints the absolute path", () => {
		const dir = repo();
		const target = add("w1", dir);
		assert.ok(existsSync(target), "the worktree was not created");
		assert.equal(run(["branch", "--show-current"], target).trim(), "w1");
		// why: a sibling at the checkout's depth, not a level deeper (cycle 003, defect 7).
		assert.equal(dirname(target), dirname(dir));
		assert.equal(basename(target), `${basename(dir)}--w1`);
		assert.equal(run(["rev-parse", "master"], dir).trim(), run(["rev-parse", "w1"], dir).trim());
	});

	test("refuses when the branch already exists", () => {
		const dir = repo();
		run(["branch", "w1"], dir); // a branch with no worktree for it
		assert.throws(() => add("w1", dir), /branch exists/);
	});

	test("add twice: the second call refuses", () => {
		const dir = repo();
		add("w1", dir);
		assert.throws(() => add("w1", dir));
	});

	test("refuses when the worktree path already exists", () => {
		const dir = repo();
		const target = add("w1", dir);
		drop("w1", dir, true); // branch and worktree both gone, path left free
		run(["branch", "w1"], dir); // recreate the branch, leave the path to collide
		mkdirSync(target, { recursive: true });
		assert.throws(() => add("w1", dir), /path exists/);
	});
});

describe("land", () => {
	test("rebases onto master, merges --ff-only, removes the worktree and the branch", () => {
		const dir = repo();
		const target = add("w1", dir);
		commit(target, "b.txt", "added\n", "feature");
		const tip = land("w1", dir);
		assert.equal(tip, run(["rev-parse", "master"], dir).trim());
		assert.equal(run(["log", "--oneline", "master"], dir).trim().split("\n").length, 2);
		assert.ok(!existsSync(target), "the worktree was not removed");
		assert.equal(
			list(dir).some((l) => l.endsWith(" w1")),
			false,
			"the branch is still listed",
		);
	});

	test("on a rebase conflict: aborts, leaves the worktree, exits via a thrown error naming the file", () => {
		const dir = repo();
		const target = add("w1", dir);
		commit(target, "a.txt", "from branch\n", "branch change");
		commit(dir, "a.txt", "from master\n", "master change");
		const masterBefore = run(["rev-parse", "master"], dir).trim();
		assert.throws(() => land("w1", dir), /a\.txt/);
		assert.ok(existsSync(target), "the worktree was removed on a conflict");
		assert.equal(run(["rev-parse", "master"], dir).trim(), masterBefore, "master moved despite the conflict");
	});
});

describe("drop", () => {
	test("removes the worktree and the branch, no merge", () => {
		const dir = repo();
		const target = add("w1", dir);
		drop("w1", dir);
		assert.ok(!existsSync(target), "the worktree was not removed");
		assert.throws(() => run(["rev-parse", "w1"], dir));
	});

	test("refuses when the branch has commits not on master, unless --force", () => {
		const dir = repo();
		const target = add("w1", dir);
		commit(target, "b.txt", "added\n", "feature");
		assert.throws(() => drop("w1", dir), /commit\(s\) not on master/);
		assert.ok(existsSync(target), "the worktree was removed despite the refusal");
		drop("w1", dir, true);
		assert.ok(!existsSync(target), "--force did not remove the worktree");
	});
});

describe("list", () => {
	test("the worktrees and their branches, one per line", () => {
		const dir = repo();
		add("w1", dir);
		const lines = list(dir);
		assert.equal(lines.length, 2);
		assert.ok(lines.some((l) => l.endsWith(" master")));
		assert.ok(lines.some((l) => l.endsWith(" w1")));
	});
});
