import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { makeFractalHandler } from "../extension/index.ts";
import { makeIndexer } from "../extension/indexer.ts";
import { makeTracker } from "../extension/tracker.ts";
import { makeFakeCtx, makeFakePi } from "./fixtures/fake-pi.mjs";

const FIXTURES = fileURLToPath(new URL("../../cmd/fixtures", import.meta.url));
const saved = { ...process.env };
const dirs: string[] = [];

function temp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

// why: the init op reaches its binding by name from PATH, the way a user's box does, so the
// fake is cmd/fixtures on PATH: one pair of fakes for the shell entry point and for these.
function fakes(): { calls: () => string[][] } {
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
				.map((line) => JSON.parse(line) as string[]),
	};
}

afterEach(() => {
	for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
	Object.assign(process.env, saved);
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("tracker.init", () => {
	test("initializes the tracker in the repo, then is a no-op", async () => {
		const repo = temp("fractal-repo-");
		const fake = fakes();
		const tracker = makeTracker();
		assert.equal(await tracker.init(repo), "tracker: initialized (beads)");
		assert.deepEqual(
			fake.calls().map((c) => c.slice(0, 2)),
			[
				["bd", "init"],
				["bd", "config"],
			],
		);
		assert.ok(existsSync(join(repo, ".beads")));
		assert.equal(await tracker.init(repo), "tracker: ready (beads)");
		assert.equal(fake.calls().length, 2, "the second init reached the binding");
	});
});

describe("indexer.init", () => {
	test("initializes the index in the repo, then is a no-op", async () => {
		const repo = temp("fractal-repo-");
		const fake = fakes();
		const indexer = makeIndexer();
		assert.equal(await indexer.init(repo), "indexer: initialized (codegraph)");
		assert.deepEqual(fake.calls(), [["codegraph", "init", repo, "-y"]]);
		assert.ok(existsSync(join(repo, ".codegraph")));
		assert.equal(await indexer.init(repo), "indexer: ready (codegraph)");
		assert.equal(fake.calls().length, 1, "the second init reached the binding");
	});
});

describe("the /fractal handler", () => {
	// why: this is the step the user no longer takes. The handler readies the session's own
	// repo before the lead prompt exists, so a lead never has to and never can forget.
	test("readies the session cwd before it builds the lead prompt", async () => {
		const home = temp("fractal-home-");
		writeFileSync(join(home, "spec.md"), "SPEC");
		writeFileSync(join(home, "code-axis.md"), "AXIS");
		const seen: string[][] = [];
		const pi = makeFakePi();
		const ctx = makeFakeCtx();
		await makeFractalHandler(
			pi as never,
			() => home,
			(cwd, base) => {
				assert.equal(pi.userMessages.length, 0, "the prompt was built before the init");
				seen.push([cwd, base]);
				return "ok";
			},
		)("build the thing", ctx as never);
		assert.deepEqual(seen, [[ctx.cwd, home]]);
		assert.equal(pi.userMessages.length, 1);
	});

	test("reports a failed init through the UI and sends no turn", async () => {
		const pi = makeFakePi();
		const ctx = makeFakeCtx();
		await makeFractalHandler(
			pi as never,
			() => "home",
			() => {
				throw new Error("tracker: no beads binding on the path. Run: node install.mjs");
			},
		)("build the thing", ctx as never);
		assert.equal(pi.userMessages.length, 0);
		assert.equal(ctx.notices[0].level, "error");
		assert.match(ctx.notices[0].msg, /node install\.mjs/);
	});
});
