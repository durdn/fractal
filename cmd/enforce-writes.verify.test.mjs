// cmd/enforce-writes.verify.test.mjs: the behavior the first suite leaves untested:
// bd runs but answers non-zero, the item is not in the tracker. The commit must be
// rejected with the tracker's own reason, not with a parse error.
// usage: node --test cmd/enforce-writes.verify.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, test } from "node:test";
import { check } from "./enforce-writes.mjs";

const saved = { ...process.env };
const dirs = [];

function temp(prefix) {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

function git(args, cwd) {
	const r = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

function repo() {
	const dir = temp("fractal-ewv-repo-");
	git(["init", "-b", "master"], dir);
	git(["config", "user.email", "a@b.c"], dir);
	git(["config", "user.name", "t"], dir);
	writeFileSync(join(dir, "a.txt"), "base\n");
	git(["add", "."], dir);
	git(["commit", "-m", "init"], dir);
	return dir;
}

// why: bd on PATH, found and runnable, but exiting non-zero the way the real one does
// on an unknown id: nothing on stdout, the reason on stderr.
function fakeBdMissingItem() {
	const dir = temp("fractal-ewv-bd-");
	const script = join(dir, "fake-bd.mjs");
	writeFileSync(script, "console.error('no such item ' + process.argv[3]); process.exit(1);");
	writeFileSync(join(dir, "bd"), `#!/bin/sh\nexec node "${script}" "$@"\n`, { mode: 0o755 });
	writeFileSync(join(dir, "bd.cmd"), `@node "${script}" %*\n`);
	process.env.PATH = `${dir}${delimiter}${saved.PATH}`;
}

afterEach(() => {
	for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
	Object.assign(process.env, saved);
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("an item the tracker does not have: rejected, with bd's own reason", () => {
	const dir = repo();
	fakeBdMissingItem();
	writeFileSync(join(dir, "a.txt"), "changed\n");
	git(["add", "a.txt"], dir);
	const file = join(dir, "MSG");
	writeFileSync(file, "feat: fractal-ghost1: a thing\n");
	const result = check(file, dir);
	assert.equal(result.code, 1);
	assert.match(result.stderr[0], /bd show fractal-ghost1/);
	assert.match(result.stderr[0], /no such item fractal-ghost1/);
});
