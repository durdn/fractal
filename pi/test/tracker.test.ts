import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeTracker, toItem } from "../extension/tracker.ts";
import { runBin } from "../extension/types.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/fake-bd.mjs", import.meta.url));
const saved = { ...process.env };
const dirs: string[] = [];

// why: the fixture is a .mjs and execFileSync cannot exec one on Windows, so the fake bd
// is `node --import <fixture>`, which runs the fixture and exits before any entry script.
function fake(items: unknown[] = [], lockFails = 0) {
	const dir = mkdtempSync(join(tmpdir(), "fractal-bd-"));
	dirs.push(dir);
	const state = join(dir, "state.json");
	const log = join(dir, "log.ndjson");
	writeFileSync(state, JSON.stringify({ items, calls: 0, created: 0 }));
	writeFileSync(log, "");
	process.env.NODE_OPTIONS = `--import ${pathToFileURL(FIXTURE).href}`;
	process.env.FRACTAL_FAKE_STATE = state;
	process.env.FRACTAL_FAKE_LOG = log;
	process.env.FRACTAL_FAKE_LOCK_FAIL = String(lockFails);
	process.env.FRACTAL_BD_BIN = process.execPath;
	return {
		logPath: log,
		calls: () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean).length,
	};
}

afterEach(() => {
	for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
	Object.assign(process.env, saved);
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("toItem", () => {
	test("maps issue_type, not type", () => {
		const item = toItem({ id: "a", issue_type: "epic", type: "WRONG" });
		assert.equal(item.issue_type, "epic");
	});

	test("ignores a record that only carries type", () => {
		assert.equal(toItem({ id: "a", type: "epic" }).issue_type, "");
	});

	test("survives a record with no dependencies key", () => {
		const root = { id: "n73", title: "root", status: "open", issue_type: "epic" };
		const item = toItem(root);
		assert.equal(item.id, "n73");
		assert.equal(item.parent, undefined);
	});

	test("maps labels and estimated_minutes, the fields the conventions ride in", () => {
		const item = toItem({ id: "a", labels: ["step:work", "by:w1"], estimated_minutes: 30 });
		assert.deepEqual(item.labels, ["step:work", "by:w1"]);
		assert.equal(item.estimated_minutes, 30);
		const bare = toItem({ id: "a" });
		assert.equal(bare.labels, undefined);
		assert.equal(bare.estimated_minutes, undefined);
	});

	test("survives {} and null and threads parent through", () => {
		const empty = toItem({});
		assert.equal(empty.id, "");
		assert.equal(empty.priority, 0);
		assert.equal(toItem(null).id, "");
		assert.equal(toItem({ id: "b", parent: "n73" }).parent, "n73");
	});
});

describe("makeTracker over the fake bd", () => {
	test("list maps every row through toItem", async () => {
		fake([{ id: "n73", title: "root", status: "open", issue_type: "epic" }]);
		const items = await makeTracker().list();
		assert.equal(items.length, 1);
		assert.equal(items[0].issue_type, "epic");
	});

	test("export returns the tracker's own rows, all of them, unmapped", async () => {
		const f = fake([{ id: "n73", title: "root", status: "open", issue_type: "epic" }]);
		const rows = JSON.parse(await makeTracker(process.execPath).export());
		assert.equal(rows[0].id, "n73");
		assert.ok(JSON.parse(readFileSync(f.logPath, "utf8").trim()).includes("--all"));
	});

	test("show unwraps the single-element array bd returns", async () => {
		fake([{ id: "n73", title: "root", status: "open", issue_type: "epic" }]);
		const item = await makeTracker(process.execPath).show("n73");
		assert.equal(Array.isArray(item), false);
		assert.equal(item.id, "n73");
		assert.equal(item.title, "root");
	});

	test("create returns only the trimmed id from --silent", async () => {
		fake();
		const id = await makeTracker(process.execPath).create("a task", { type: "task" });
		assert.equal(id, "bd-1");
	});

	test("create passes the seven conventions as labels, an estimate and JSON metadata", async () => {
		fake();
		const t = makeTracker(process.execPath);
		const id = await t.create("work item", {
			type: "task",
			step: "work",
			by: "w1",
			axis: "Code",
			grade: "opus.high",
			estimateMin: 30,
			artifact: "abc123",
			writes: ["a.py", "b.py"],
		});
		const item = await t.show(id);
		assert.deepEqual(item.labels, ["step:work", "by:w1", "axis:Code", "grade:opus.high"]);
		assert.equal(item.estimated_minutes, 30);
		assert.equal(item.metadata?.artifact, "abc123");
		// why: check.py iterates metadata.writes; a string would iterate as characters.
		assert.deepEqual(item.metadata?.writes, ["a.py", "b.py"]);
	});

	test("create sends no convention flag when none is given", async () => {
		const f = fake();
		await makeTracker(process.execPath).create("bare", { type: "task" });
		const line = readFileSync(f.logPath, "utf8").trim();
		for (const flag of ["-l", "-e", "--metadata"]) {
			assert.ok(!JSON.parse(line).includes(flag), `bare create sent ${flag}`);
		}
	});

	test("update adds labels and an estimate and merges metadata", async () => {
		fake([{ id: "n73", title: "root", status: "open", issue_type: "epic" }]);
		const t = makeTracker(process.execPath);
		await t.update("n73", { axis: "Code", writes: ["a.py"] });
		await t.update("n73", { status: "closed", step: "judge", estimateMin: 15, failure: "cut" });
		const item = await t.show("n73");
		assert.equal(item.status, "closed");
		assert.deepEqual(item.labels, ["axis:Code", "step:judge"]);
		assert.equal(item.estimated_minutes, 15);
		assert.equal(item.metadata?.failure, "cut");
		assert.deepEqual(item.metadata?.writes, ["a.py"], "the earlier writes were dropped");
	});

	test("update writes status and metadata through", async () => {
		const f = fake([{ id: "n73", title: "root", status: "open", issue_type: "epic" }]);
		const t = makeTracker(process.execPath);
		await t.update("n73", { status: "in_progress", metadata: { budget_min: "20" } });
		assert.equal(f.calls(), 1);
		assert.equal((await t.show("n73")).metadata?.budget_min, "20");
	});
});

describe("lock retry", () => {
	test("one lock failure succeeds after exactly one retry", async () => {
		const f = fake([{ id: "n73", title: "root", status: "open", issue_type: "epic" }], 1);
		const items = await makeTracker(process.execPath).list();
		assert.equal(items.length, 1);
		assert.equal(f.calls(), 2);
	});

	test("two lock failures throw, name the command, and do not retry again", async () => {
		const f = fake([], 2);
		await assert.rejects(
			() => makeTracker(process.execPath).list(),
			(e: Error) => {
				assert.match(e.message, /list --json failed/);
				assert.match(e.message, /locked/);
				return true;
			},
		);
		assert.equal(f.calls(), 2);
	});

	test("a non-lock failure throws without retrying", async () => {
		const f = fake();
		await assert.rejects(() => makeTracker(process.execPath).show("nope"));
		assert.equal(f.calls(), 1);
	});
});

describe("windows .cmd shim", () => {
	// why: bd/codegraph ship as scoop .cmd shims; execFileSync/spawnSync cannot exec those
	// directly on Windows, only cmd.exe can. This pins that the tracker's cross-platform
	// helper actually goes through cmd.exe and can invoke a real .cmd file end to end.
	test("list works when FRACTAL_BD_BIN points at a .cmd shim", {
		skip: process.platform !== "win32" && "cmd.exe shim invocation is Windows-only",
	}, async () => {
		const f = fake([{ id: "n73", title: "root", status: "open", issue_type: "epic" }]);
		delete process.env.NODE_OPTIONS; // shim carries its own --import; avoid a duplicate
		const dir = mkdtempSync(join(tmpdir(), "fractal-bd-shim-"));
		dirs.push(dir);
		const shim = join(dir, "bd.cmd");
		const fixtureUrl = pathToFileURL(FIXTURE).href;
		writeFileSync(shim, `@"${process.execPath}" --import "${fixtureUrl}" %*\r\n`);
		process.env.FRACTAL_BD_BIN = shim;
		const items = await makeTracker().list();
		assert.equal(items.length, 1);
		assert.equal(items[0].id, "n73");
		assert.equal(f.calls(), 1);
	});
});

function bdOnPath(): boolean {
	try {
		runBin("bd", ["--version"]);
		return true;
	} catch {
		return false;
	}
}

describe("the real bd binary", () => {
	// why: the fake bd is a node process, so it never exercised the .cmd shim that bd
	// actually is on Windows, and the fake would have passed while every real call failed.
	// This is the only test that runs the binding end to end against the tracker on disk.
	test("list all returns the fractal tree, including fractal-n73", async (t) => {
		if (!bdOnPath()) return t.skip("bd not on path");
		const items = await makeTracker().list({ all: true });
		assert.ok(items.length > 0, "bd returned no items at all");
		assert.ok(
			items.some((i) => i.id === "fractal-n73"),
			"fractal-n73 is missing from bd list --all",
		);
	});
});
