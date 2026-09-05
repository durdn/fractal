// cmd/enforce-writes.test.mjs: tests for cmd/enforce-writes.mjs, against a real git
// repo in a temp dir and a fake bd on PATH that answers `show <id> --json` from a
// fixture map. No live tracker.
// usage: node --test cmd/enforce-writes.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { check, isAllowed, parseSubject } from "./enforce-writes.mjs";

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
	return r.stdout;
}

// why: one commit on master, nothing else, is all any test below needs; the repo
// itself never has to know about bd or enforce-writes.
function repo() {
	const dir = temp("fractal-ew-repo-");
	git(["init", "-b", "master"], dir);
	git(["config", "user.email", "a@b.c"], dir);
	git(["config", "user.name", "t"], dir);
	writeFileSync(join(dir, "base.txt"), "base\n");
	git(["add", "."], dir);
	git(["commit", "-m", "init"], dir);
	return dir;
}

// why: the fake answers exactly one bd subcommand, `show <id> --json`, from a map
// keyed by id, given through an env var so each test supplies its own fixture without
// a fixture file on disk. Reached as `bd` through a shim, same as cmd/fixtures does for
// init.test.mjs, so enforce-writes.mjs's own PATH lookup needs no code aware of tests.
function fakeBd(map) {
	const dir = temp("fractal-ew-bd-");
	const script = join(dir, "fake-bd.mjs");
	writeFileSync(
		script,
		[
			"const [cmd, id, flag] = process.argv.slice(2);",
			'if (process.env.FRACTAL_FAKE_BD_MISSING) { process.stderr.write("bd: not found\\n"); process.exit(127); }',
			'if (cmd !== "show" || flag !== "--json") { process.stderr.write("fake-bd: unsupported\\n"); process.exit(2); }',
			"const map = JSON.parse(process.env.FRACTAL_FAKE_BD_MAP);",
			"const item = map[id];",
			'if (!item) { process.stderr.write("fake-bd: no such item " + id + "\\n"); process.exit(1); }',
			"process.stdout.write(JSON.stringify([item]));",
		].join("\n"),
	);
	writeFileSync(join(dir, "bd"), `#!/bin/sh\nexec node "${script}" "$@"\n`, { mode: 0o755 });
	writeFileSync(join(dir, "bd.cmd"), `@node "${script}" %*\n`);
	process.env.PATH = `${dir}${delimiter}${saved.PATH}`;
	process.env.FRACTAL_FAKE_BD_MAP = JSON.stringify(map);
	return dir;
}

function msgFile(dir, subject) {
	const file = join(dir, "MSG");
	writeFileSync(file, `${subject}\n`);
	return file;
}

function stage(dir, name, content) {
	writeFileSync(join(dir, name), content);
	git(["add", name], dir);
}

afterEach(() => {
	for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
	Object.assign(process.env, saved);
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("parseSubject", () => {
	test("accepts a known type and a fractal item", () => {
		assert.deepEqual(parseSubject("feat: fractal-mw4.3.1: a thing"), {
			type: "feat",
			item: "fractal-mw4.3.1",
		});
	});

	test("rejects an unknown type, a missing item, or no message", () => {
		assert.equal(parseSubject("oops: fractal-a1: thing"), null);
		assert.equal(parseSubject("feat: thing"), null);
		assert.equal(parseSubject("feat: fractal-a1:"), null);
	});
});

describe("isAllowed", () => {
	test("exact file, directory prefix, and .beads are allowed; a stray path is not", () => {
		const writes = ["cmd/enforce-writes.mjs", "cmd/hooks"];
		assert.ok(isAllowed("cmd/enforce-writes.mjs", writes));
		assert.ok(isAllowed("cmd/hooks/commit-msg", writes));
		assert.ok(isAllowed(".beads/issues.jsonl", writes));
		assert.ok(!isAllowed("cmd/worktree.mjs", writes));
		assert.ok(!isAllowed("cmd-hooks-evil.mjs", writes));
	});
});

describe("claims", () => {
	test("a Name claim holds nothing in the diff, so a staged path beside it is refused", () => {
		const dir = repo();
		fakeBd({ "fractal-a1": { id: "fractal-a1", metadata: { claims: ["name:the-x-account"] } } });
		stage(dir, "a.txt", "harvested\n");
		const result = check(msgFile(dir, "feat: fractal-a1: harvest"), dir);
		assert.equal(result.code, 1);
		assert.match(result.stderr[0], /outside fractal-a1's claims: a\.txt/);
	});

	test("a claim list of paths passes exactly as writes did", () => {
		const dir = repo();
		fakeBd({ "fractal-a1": { id: "fractal-a1", metadata: { claims: ["a.txt", "name:the-x-account"] } } });
		stage(dir, "a.txt", "changed\n");
		assert.deepEqual(check(msgFile(dir, "feat: fractal-a1: both"), dir), { code: 0, stderr: [] });
	});

	test("an item written before claims still reads its writes", () => {
		const dir = repo();
		fakeBd({ "fractal-a1": { id: "fractal-a1", metadata: { writes: ["a.txt"] } } });
		stage(dir, "a.txt", "changed\n");
		assert.deepEqual(check(msgFile(dir, "feat: fractal-a1: old item"), dir), { code: 0, stderr: [] });
	});
});

describe("check", () => {
	test("a good commit, inside claims, passes with no output", () => {
		const dir = repo();
		fakeBd({ "fractal-a1": { id: "fractal-a1", metadata: { writes: ["a.txt"] } } });
		stage(dir, "a.txt", "changed\n");
		const result = check(msgFile(dir, "feat: fractal-a1: change a"), dir);
		assert.deepEqual(result, { code: 0, stderr: [] });
	});

	test("a bad subject fails before the tracker is ever asked", () => {
		const dir = repo();
		const result = check(msgFile(dir, "change a thing"), dir);
		assert.equal(result.code, 1);
		assert.match(result.stderr[0], /bad subject/);
		assert.match(result.stderr[1], /want type: item: message; type in feat fix maint log doc spec port/);
	});

	test("a path outside claims fails and names the path and the claims", () => {
		const dir = repo();
		fakeBd({ "fractal-a1": { id: "fractal-a1", metadata: { writes: ["a.txt"] } } });
		stage(dir, "b.txt", "changed\n");
		const result = check(msgFile(dir, "feat: fractal-a1: change b"), dir);
		assert.equal(result.code, 1);
		assert.match(result.stderr[0], /b\.txt/);
		assert.match(result.stderr[1], /a\.txt/);
	});

	test("a directory prefix in claims covers a file under it", () => {
		const dir = repo();
		fakeBd({ "fractal-a1": { id: "fractal-a1", metadata: { writes: ["cmd/hooks"] } } });
		mkdirSync(join(dir, "cmd", "hooks"), { recursive: true });
		stage(dir, "cmd/hooks/commit-msg", "#!/bin/sh\n");
		const result = check(msgFile(dir, "feat: fractal-a1: wire the hook"), dir);
		assert.deepEqual(result, { code: 0, stderr: [] });
	});

	test("no claims anywhere in the parent chain: allowed, a stderr note", () => {
		const dir = repo();
		fakeBd({
			"fractal-a1.1": { id: "fractal-a1.1", parent: "fractal-a1", metadata: {} },
			"fractal-a1": { id: "fractal-a1", metadata: {} },
		});
		stage(dir, "anything.txt", "x\n");
		const result = check(msgFile(dir, "feat: fractal-a1.1: epic level"), dir);
		assert.equal(result.code, 0);
		assert.match(result.stderr[0], /no claims on fractal-a1\.1 or its parents; staged paths not checked/);
	});

	test("claims inherited from a parent allow a staged file the parent names", () => {
		const dir = repo();
		fakeBd({
			"fractal-a1.1": { id: "fractal-a1.1", parent: "fractal-a1", metadata: {} },
			"fractal-a1": { id: "fractal-a1", metadata: { writes: ["a.txt"] } },
		});
		stage(dir, "a.txt", "changed\n");
		const result = check(msgFile(dir, "feat: fractal-a1.1: step"), dir);
		assert.deepEqual(result, { code: 0, stderr: [] });
	});

	test("bd not found: exit 1 with the error, no item, no commit", () => {
		const dir = repo();
		fakeBd({});
		process.env.FRACTAL_FAKE_BD_MISSING = "1";
		stage(dir, "a.txt", "changed\n");
		const result = check(msgFile(dir, "feat: fractal-a1: change a"), dir);
		assert.equal(result.code, 1);
		assert.match(result.stderr[0], /bd show/);
	});

	test(".beads/*.jsonl is always allowed, even outside claims", () => {
		const dir = repo();
		fakeBd({ "fractal-a1": { id: "fractal-a1", metadata: { writes: ["a.txt"] } } });
		stage(dir, "a.txt", "changed\n");
		mkdirSync(join(dir, ".beads"), { recursive: true });
		stage(dir, ".beads/issues.jsonl", "{}\n");
		const result = check(msgFile(dir, "feat: fractal-a1: change a"), dir);
		assert.deepEqual(result, { code: 0, stderr: [] });
	});
});

describe("the item prefix", () => {
	test("any repo's prefix passes; bd show is the existence check", () => {
		assert.deepEqual(parseSubject("doc: acme-is2.3: cycle record opened"), {
			type: "doc",
			item: "acme-is2.3",
		});
		assert.deepEqual(parseSubject("feat: fractal-a1: x"), { type: "feat", item: "fractal-a1" });
		assert.equal(parseSubject("feat: is2.3: no prefix"), null);
	});
});
