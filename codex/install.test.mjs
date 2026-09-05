import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deploy, source } from "./install.mjs";
import { runtime } from "./runtime.mjs";

function fixture(t) {
	const dir = mkdtempSync(join(tmpdir(), "fractal codex "));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return { dir, dest: join(dir, "skills", "fractal") };
}

test("install, reinstall, linked runtime from another cwd, and uninstall retain the source", (t) => {
	const { dir, dest } = fixture(t);
	const original = readFileSync(join(source, "SKILL.md"));
	assert.match(deploy({ dest }), /installed/);
	assert.equal(realpathSync(dest), realpathSync(source));
	assert.match(deploy({ dest }), /ready/);
	const result = spawnSync(process.execPath, [join(dest, "runtime.mjs")], {
		cwd: dir,
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	const manifest = JSON.parse(result.stdout);
	assert.equal(manifest.harness, "codex");
	assert.equal(manifest.home, realpathSync(join(source, "..")));
	assert.equal(
		readFileSync(manifest.spec, "utf8").includes(`v${manifest.version},`),
		true,
	);
	for (const path of Object.values(manifest.axes)) assert.ok(existsSync(path));
	assert.match(deploy({ dest, uninstall: true }), /removed/);
	assert.equal(existsSync(dest), false);
	assert.deepEqual(readFileSync(join(source, "SKILL.md")), original);
	assert.match(deploy({ dest, uninstall: true }), /absent/);
});

test("install and uninstall refuse an existing directory or file without changing it", (t) => {
	const { dir } = fixture(t);
	for (const kind of ["file", "directory"]) {
		const dest = join(dir, kind);
		if (kind === "directory") mkdirSync(dest);
		const sentinel = kind === "directory" ? join(dest, "mine.txt") : dest;
		writeFileSync(sentinel, "user content");
		for (const uninstall of [false, true]) {
			assert.throws(() => deploy({ dest, uninstall }), /refusing/);
			assert.equal(readFileSync(sentinel, "utf8"), "user content");
		}
	}
});

test("unrelated and dangling links are refused without following or removing them", (t) => {
	const { dir, dest } = fixture(t);
	mkdirSync(join(dir, "skills"));
	const elsewhere = join(dir, "elsewhere");
	mkdirSync(elsewhere);
	writeFileSync(join(elsewhere, "mine.txt"), "keep");
	symlinkSync(
		elsewhere,
		dest,
		process.platform === "win32" ? "junction" : "dir",
	);
	for (const uninstall of [false, true])
		assert.throws(() => deploy({ dest, uninstall }), /refusing/);
	assert.equal(readFileSync(join(elsewhere, "mine.txt"), "utf8"), "keep");
	rmSync(elsewhere, { recursive: true });
	for (const uninstall of [false, true])
		assert.throws(() => deploy({ dest, uninstall }), /refusing/);
	assert.ok(lstatSync(dest).isSymbolicLink());
});

test("Herdr availability needs the host and both installed binding files", (t) => {
	const { dir } = fixture(t);
	assert.equal(runtime({ HERDR_ENV: "1" }, dir).herdr.available, false);
	const skill = join(dir, ".agents", "skills", "herdr-subagents");
	mkdirSync(join(skill, "scripts"), { recursive: true });
	writeFileSync(join(skill, "SKILL.md"), "fixture");
	assert.equal(runtime({ HERDR_ENV: "1" }, dir).herdr.available, false);
	writeFileSync(join(skill, "scripts", "codex-subagents.mjs"), "fixture");
	assert.equal(runtime({ HERDR_ENV: "1" }, dir).herdr.available, true);
	assert.equal(runtime({}, dir).herdr.available, false);
});
