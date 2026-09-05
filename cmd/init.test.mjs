// cmd/init.test.mjs: tests for cmd/init.mjs, over the fake bd and codegraph in
// cmd/fixtures on a temporary PATH. No real binding, no network.
// usage: node --test cmd/init.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { HOOKS, initRepo } from "./init.mjs";

const FIXTURES = fileURLToPath(new URL("./fixtures", import.meta.url));
const CLI = fileURLToPath(new URL("./init.mjs", import.meta.url));
const saved = { ...process.env };
const dirs = [];

function temp(prefix) {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

// why: the bindings are reached by name from PATH, exactly as a user's box reaches them, so
// a fake is a folder on PATH and nothing in cmd/init.mjs has to know it is under test.
function fakes() {
	const log = join(temp("fractal-log-"), "calls.ndjson");
	writeFileSync(log, "");
	process.env.PATH = `${FIXTURES}${delimiter}${saved.PATH}`;
	process.env.FRACTAL_FAKE_LOG = log;
	return {
		calls: () =>
			readFileSync(log, "utf8")
				.trim()
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
	};
}

// why: dropping PATH from the child's env does not work. libuv puts the parent's PATH back
// when the env it is handed has none, so a blank box is an empty folder as the whole PATH.
// The key is matched case insensitively because Windows spells it Path as often as PATH.
function envWithPath(value) {
	const out = { PATH: value };
	for (const [k, v] of Object.entries(process.env)) if (k.toLowerCase() !== "path") out[k] = v;
	return out;
}

afterEach(() => {
	for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
	Object.assign(process.env, saved);
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("initRepo", () => {
	test("first run initializes both interfaces, through their bindings", () => {
		const repo = temp("fractal-repo-");
		const fake = fakes();
		assert.deepEqual(initRepo(repo), [
			"tracker: initialized (beads)",
			"indexer: initialized (codegraph)",
			"hooks: skipped (not a git repo)",
		]);
		assert.deepEqual(fake.calls(), [
			["bd", "init", "--skip-agents", "--skip-hooks", "--non-interactive", "-q", "--init-if-missing"],
			["bd", "config", "set", "export.auto", "true"],
			["codegraph", "init", repo, "-y"],
		]);
		assert.ok(existsSync(join(repo, ".beads")), "the tracker was not initialized in the repo");
		assert.ok(existsSync(join(repo, ".codegraph")), "the indexer was not initialized");
	});

	test("second run is a no-op: no binding is called at all", () => {
		const repo = temp("fractal-repo-");
		const fake = fakes();
		initRepo(repo);
		const after = fake.calls().length;
		assert.deepEqual(initRepo(repo), [
			"tracker: ready (beads)",
			"indexer: ready (codegraph)",
			"hooks: skipped (not a git repo)",
		]);
		assert.equal(fake.calls().length, after, "the second run reached a binding");
	});

	test("a failing binding fails the init, with the binding's own words", () => {
		const repo = temp("fractal-repo-");
		fakes();
		process.env.FRACTAL_FAKE_FAIL = "bd";
		assert.throws(() => initRepo(repo), /boom, the binding refused/);
	});
});

describe("the hooks", () => {
	// why: a git repo is the one thing the hook step needs; the fake bd and codegraph stay.
	function gitRepo() {
		const dir = temp("fractal-repo-");
		spawnSync("git", ["init", "-q", "-b", "master"], { cwd: dir });
		return dir;
	}

	test("a git repo gets core.hooksPath wired to the home's cmd/hooks, once", () => {
		const repo = gitRepo();
		fakes();
		assert.equal(initRepo(repo)[2], "hooks: wired (git)");
		const got = spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: repo, encoding: "utf8" });
		assert.equal(got.stdout.trim(), HOOKS);
		assert.equal(initRepo(repo)[2], "hooks: ready (git)");
	});
});

describe("the command line", () => {
	test("defaults to the current directory and prints one line per interface", () => {
		const repo = temp("fractal-repo-");
		fakes();
		const r = spawnSync(process.execPath, [CLI], { cwd: repo, encoding: "utf8" });
		assert.equal(r.status, 0, r.stderr);
		assert.deepEqual(r.stdout.trim().split(/\r?\n/), [
			"tracker: initialized (beads)",
			"indexer: initialized (codegraph)",
			"hooks: skipped (not a git repo)",
		]);
		assert.ok(existsSync(join(repo, ".beads")), "the default repo was not the current directory");
	});

	test("a missing binding exits 1 and names the installer", () => {
		const repo = temp("fractal-repo-");
		const r = spawnSync(process.execPath, [CLI, repo], {
			encoding: "utf8",
			env: envWithPath(temp("fractal-blank-")),
		});
		assert.equal(r.status, 1);
		assert.match(r.stderr, /tracker: no beads binding on the path/);
		assert.match(r.stderr, /node install\.mjs/);
		assert.equal(r.stdout.trim(), "", "it initialized something without a binding");
	});
});
