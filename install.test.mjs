import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "./install.mjs";

test("default install selects all three deployments", () => {
	assert.deepEqual(parse([]), {
		claudeCode: true,
		pi: true,
		codex: true,
		uninstall: false,
		explicitCodex: false,
	});
});

test("explicit flags select only their deployments, in either order", () => {
	for (const [flag, key] of [
		["--claude-code", "claudeCode"],
		["--pi", "pi"],
		["--codex", "codex"],
	]) {
		const opts = parse([flag]);
		for (const name of ["claudeCode", "pi", "codex"])
			assert.equal(opts[name], name === key);
	}
	for (const flags of [
		["--pi", "--codex"],
		["--codex", "--pi"],
	]) {
		assert.deepEqual(parse(flags), {
			claudeCode: false,
			pi: true,
			codex: true,
			uninstall: false,
			explicitCodex: true,
		});
	}
});

test("uninstall selection, help, and invalid arguments", () => {
	assert.deepEqual(parse(["--codex", "--uninstall"]), {
		claudeCode: false,
		pi: false,
		codex: true,
		uninstall: true,
		explicitCodex: true,
	});
	assert.equal(parse(["--help"]), null);
	assert.throws(() => parse(["--unknown"]), /unknown argument/);
});
