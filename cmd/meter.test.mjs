// cmd/meter.test.mjs: tests for cmd/meter.mjs, driven through its command line
// over throwaway git repos and the real lizard on PATH. No network, no fixture
// that takes an hour: each case is a two-file repo and one commit.
// usage: node --test cmd/meter.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./meter.mjs", import.meta.url));
const dirs = [];

// why: lizard counts one for the function plus one per decision, so a fixture
// built from a known number of ifs has a complexity a reader can check by eye;
// `lizard --csv` on this exact shape reports ccn 12, nloc 25.
const BRANCHES = 11;
const GNARLY = [
	"def gnarly(n):",
	"    total = 0",
	...Array.from({ length: BRANCHES }, (_, i) => [`    if n > ${i}:`, `        total += ${i}`]).flat(),
	"    return total",
	"",
].join("\n");
const GNARLY_CCN = BRANCHES + 1;
const GNARLY_NLOC = BRANCHES * 2 + 3;
const CALM = "def calm(a, b):\n    return a + b\n";

function temp(prefix) {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

function run(args, cwd) {
	const r = spawnSync("git", args, { cwd, encoding: "utf8" });
	assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
	return (r.stdout ?? "").trim();
}

// why: the meter selects by `git diff <base>`, which only sees tracked files, so
// the change under test has to be a real commit on top of a real base commit.
function repo(files) {
	const dir = temp("fractal-meter-");
	run(["init", "-q"], dir);
	run(["config", "user.email", "test@example.com"], dir);
	run(["config", "user.name", "test"], dir);
	writeFileSync(join(dir, "base.txt"), "base\n");
	run(["add", "-A"], dir);
	run(["commit", "-qm", "base"], dir);
	const base = run(["rev-parse", "HEAD"], dir);
	for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
	run(["add", "-A"], dir);
	run(["commit", "-qm", "change"], dir);
	return { dir, base };
}

// why: dropping PATH from the child's env does not work, libuv hands the parent's
// back; a box without lizard is the real PATH with the directories that hold it
// removed, so git and cmd.exe still resolve. Path is spelled both ways on Windows.
function envWithPath(value) {
	const out = { PATH: value };
	for (const [k, v] of Object.entries(process.env)) if (k.toLowerCase() !== "path") out[k] = v;
	return out;
}

function pathWithout(bin) {
	const exts = ["", ".exe", ".cmd", ".bat"];
	return (process.env.PATH ?? "")
		.split(delimiter)
		.filter((dir) => dir && !exts.some((ext) => existsSync(join(dir, bin + ext))))
		.join(delimiter);
}

function meter(dir, args = [], env) {
	return spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8", env });
}

function lines(r) {
	return r.stdout.trim().split(/\r?\n/).filter(Boolean);
}

afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("the meter over the changed files", () => {
	test("a function over the threshold is printed with its numbers, exit 1", () => {
		const { dir, base } = repo({ "gnarly.py": GNARLY });
		const r = meter(dir, ["--base", base]);
		assert.deepEqual(lines(r), [
			`gnarly.py: gnarly ccn ${GNARLY_CCN} nloc ${GNARLY_NLOC}`,
			`files 1 functions 1 max ccn ${GNARLY_CCN} total nloc ${GNARLY_NLOC}`,
		]);
		assert.equal(r.status, 1, r.stderr);
	});

	test("a clean file prints the summary and nothing else, exit 0", () => {
		const { dir, base } = repo({ "calm.py": CALM });
		const r = meter(dir, ["--base", base]);
		assert.deepEqual(lines(r), ["files 1 functions 1 max ccn 1 total nloc 2"]);
		assert.equal(r.status, 0, r.stderr);
	});

	test("--ccn moves the boundary: over at ccn - 1, clean at ccn", () => {
		const { dir, base } = repo({ "gnarly.py": GNARLY });
		const under = meter(dir, ["--base", base, "--ccn", String(GNARLY_CCN - 1)]);
		assert.equal(under.status, 1, under.stderr);
		assert.match(under.stdout, /gnarly\.py: gnarly ccn 12/);
		const at = meter(dir, ["--base", base, "--ccn", String(GNARLY_CCN)]);
		assert.deepEqual(lines(at), [`files 1 functions 1 max ccn ${GNARLY_CCN} total nloc ${GNARLY_NLOC}`]);
		assert.equal(at.status, 0, at.stderr);
	});

	test("markdown is skipped and named, a shell file gets sh -n and a line count", () => {
		const { dir, base } = repo({ "notes.md": "# notes\n", "script.sh": "#!/bin/sh\necho hi\n" });
		const r = meter(dir, ["--base", base]);
		assert.deepEqual(lines(r), [
			"skip notes.md (markdown)",
			"script.sh: sh -n ok, 2 lines",
			"files 0 functions 0 max ccn 0 total nloc 0",
		]);
		assert.equal(r.status, 0, r.stderr);
	});

	test("a shell file that fails sh -n fails the run", () => {
		const { dir, base } = repo({ "broken.sh": "#!/bin/sh\nif true\n" });
		const r = meter(dir, ["--base", base]);
		assert.match(r.stdout, /broken\.sh: sh -n FAILED, 2 lines/);
		assert.equal(r.status, 1, r.stderr);
	});

	test("lizard missing from PATH exits 1 and names the installer", () => {
		const { dir, base } = repo({ "calm.py": CALM });
		const r = meter(dir, ["--base", base], envWithPath(pathWithout("lizard")));
		assert.equal(r.status, 1);
		assert.match(r.stderr, /uv tool install lizard/);
		assert.equal(r.stdout.trim(), "", "it measured something without the binding");
	});
});
