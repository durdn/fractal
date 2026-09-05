import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeFractalRunTool, makeRunner, type RunSpec } from "../extension/runner.ts";
import { runBin } from "../extension/types.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/fake-run-sh.mjs", import.meta.url));
const REAL_RUN_SH = fileURLToPath(new URL("../../cmd/run.sh", import.meta.url));
const FAKE_CLI = fileURLToPath(new URL("../../cmd/fixtures/fake-cli.sh", import.meta.url));
const saved = { ...process.env };
const dirs: string[] = [];

function temp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

// why: the fixture is a .mjs and spawnSync cannot exec one on Windows, so the fake run.sh is
// `node --import <fixture>`, which runs the fixture and exits before any entry script. The
// script path handed to makeRunner is therefore node itself.
function fake(mode = "ok") {
	const dir = temp("fractal-run-");
	const argv = join(dir, "argv.json");
	process.env.NODE_OPTIONS = `--import ${pathToFileURL(FIXTURE).href}`;
	process.env.FRACTAL_FAKE_RUNSH = mode;
	process.env.FRACTAL_FAKE_RUNSH_ARGV = argv;
	return { cwd: dir, argv: () => JSON.parse(readFileSync(argv, "utf8")) as string[] };
}

const spec = (o: Partial<RunSpec> = {}): RunSpec => ({
	runner: "pi",
	model: "model-a",
	budgetMin: 1,
	cwd: process.cwd(),
	...o,
});
const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;

afterEach(() => {
	for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
	Object.assign(process.env, saved);
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("makeRunner over the fake run.sh", () => {
	test("returns the script's JSON line, trimmed", () => {
		const f = fake();
		const line = makeRunner(process.execPath).run(spec({ cwd: f.cwd, task: "do it" }));
		assert.equal(line, line.trim(), "the trailing newlines survived");
		assert.deepEqual(parse(line), {
			runner: "pi",
			model: "model-a",
			seconds: 2,
			reply: "fake run.sh reply: do it",
			usage: { input: 11, output: 3, cacheRead: 0, cacheWrite: 0, cost: 0.5 },
			exit: 0,
		});
	});

	test("passes runner, model, budget and cwd positionally, and never the task", () => {
		const f = fake();
		const run = makeRunner(process.execPath);
		run.run(spec({ cwd: f.cwd, budgetMin: 30, task: "a task with spaces" }));
		assert.deepEqual(f.argv(), ["pi", "model-a", "30", f.cwd], "the task reached the argv");
		run.run(spec({ cwd: f.cwd, runner: "claude" }));
		assert.deepEqual(f.argv(), ["claude", "model-a", "1", f.cwd]);
	});

	// why: the task is the one argument a caller does not control the bytes of. On stdin no
	// shell, and no cmd.exe, ever re-splits it; the fixture echoes what it read back.
	test("hands the task on stdin, byte for byte", () => {
		const f = fake();
		const nasty = 'say ok "dq" 100% $DOLLAR & amp | pipe ^caret\nsecond line';
		const got = parse(makeRunner(process.execPath).run(spec({ cwd: f.cwd, task: nasty })));
		assert.equal(got.reply, `fake run.sh reply: ${nasty}`);
		assert.deepEqual(f.argv(), ["pi", "model-a", "1", f.cwd]);
	});

	test("no task is an empty stdin, not a missing argument", () => {
		const f = fake();
		const got = parse(makeRunner(process.execPath).run(spec({ cwd: f.cwd })));
		assert.deepEqual(f.argv(), ["pi", "model-a", "1", f.cwd]);
		assert.equal(got.reply, "fake run.sh reply");
	});

	test("a failing run comes back as the script's own JSON line, not a substitute", () => {
		// why: run.sh prints its one JSON line and exits 1, and the line carries the reason
		// and the child's code. This pins that the exit status does not discard it: stderr
		// must not stand in for the reply, and exit:124 must survive.
		const f = fake("fail");
		const got = parse(makeRunner(process.execPath).run(spec({ cwd: f.cwd })));
		assert.equal(got.exit, 124, "the script's exit:124 was thrown away");
		assert.deepEqual(got.usage, { input: 11, output: 3, cacheRead: 0, cacheWrite: 0, cost: 0.5 });
		assert.equal(got.runner, "pi");
		assert.equal(got.model, "model-a");
		assert.equal(got.reply, "timeout: budget of 1m exceeded");
		assert.doesNotMatch(String(got.reply), /run\.sh: the run failed/, "stderr replaced the line");
	});

	test("a failure with no stderr still yields the same shape", () => {
		const f = fake("silent-fail");
		const got = parse(makeRunner(process.execPath).run(spec({ cwd: f.cwd })));
		assert.equal(got.exit, 1);
		// why: the wrapper's own failure line carries the same five keys every other line
		// carries, so a caller reading usage.cost never has to know which path made it.
		assert.deepEqual(got.usage, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
		assert.match(String(got.reply), /exited with status 2/);
	});

	test("seconds on a failure are measured, not the script's", () => {
		const f = fake("slow-fail");
		const got = parse(makeRunner(process.execPath).run(spec({ cwd: f.cwd })));
		assert.ok(
			typeof got.seconds === "number" && got.seconds >= 1,
			`slow failure reported ${got.seconds}s, expected the measured 1s or more`,
		);
	});

	test("a home with no run.sh comes back as a failure line, not a crash", () => {
		delete process.env.FRACTAL_RUN_SH;
		const before = process.env.FRACTAL_HOME;
		process.env.FRACTAL_HOME = "/nonexistent/fractal-home";
		try {
			const got = parse(makeRunner().run(spec()));
			assert.equal(got.exit, 1);
			assert.match(String(got.reply), /run\.sh|JSON|No such file/i);
		} finally {
			if (before === undefined) delete process.env.FRACTAL_HOME;
			else process.env.FRACTAL_HOME = before;
		}
	});

	test("FRACTAL_RUN_SH is read per call, and an explicit script beats it", () => {
		const f = fake();
		process.env.FRACTAL_RUN_SH = process.execPath;
		assert.equal(parse(makeRunner().run(spec({ cwd: f.cwd }))).exit, 0);
		process.env.FRACTAL_RUN_SH = join(f.cwd, "no-such-run.sh");
		assert.equal(parse(makeRunner(process.execPath).run(spec({ cwd: f.cwd }))).exit, 0);
		assert.equal(parse(makeRunner().run(spec({ cwd: f.cwd }))).exit, 1, "the bogus env path ran");
	});
});

describe("the fractal_run tool", () => {
	test("hands back the runner's line as its text content", async () => {
		const f = fake();
		const tool = makeFractalRunTool(makeRunner(process.execPath));
		const out = await tool.execute("id", spec({ cwd: f.cwd, task: "do it" }), undefined, null, {
			cwd: f.cwd,
		});
		assert.equal(out.content.length, 1);
		assert.equal(out.content[0].type, "text");
		assert.equal(parse(out.content[0].text).reply, "fake run.sh reply: do it");
	});

	test("coerces the params pi validated into a RunSpec", async () => {
		const seen: RunSpec[] = [];
		const tool = makeFractalRunTool({
			run(s) {
				seen.push(s);
				return "{}";
			},
		});
		const params = { runner: "pi", model: "m", budgetMin: "5", cwd: "/c", task: 7 };
		await tool.execute("id", params, undefined, null, { cwd: "/c" });
		assert.deepEqual(seen[0], {
			runner: "pi",
			model: "m",
			budgetMin: 5,
			cwd: "/c",
			task: undefined,
		});
		await tool.execute("id", undefined, undefined, null, { cwd: "/c" });
		assert.deepEqual(seen[1], { runner: "", model: "", budgetMin: 0, cwd: "", task: undefined });
	});

	test("declares the name and the required params the spawn recipe names", () => {
		const tool = makeFractalRunTool();
		assert.equal(tool.name, "fractal_run");
		const params = tool.parameters as { required: string[] };
		assert.deepEqual(params.required, ["runner", "model", "budgetMin", "cwd"]);
	});
});

describe("the real cmd/run.sh", () => {
	test("the wrapper drives the actual script, with the fake CLI in place of pi", () => {
		const dir = temp("fractal-real-");
		process.env.FRACTAL_PI_BIN = FAKE_CLI;
		const got = parse(makeRunner(REAL_RUN_SH).run(spec({ cwd: dir, task: "hello" })));
		assert.equal(got.exit, 0);
		assert.equal(got.reply, "fake reply from pi");
		assert.deepEqual(got.usage, {
			input: 30,
			output: 7,
			cacheRead: 9,
			cacheWrite: 12,
			cost: 0.003,
		});
	});

	test("a run over its budget comes back as the script's timeout line", () => {
		const dir = temp("fractal-real-");
		process.env.FRACTAL_PI_BIN = FAKE_CLI;
		process.env.FRACTAL_FAKE_SLEEP = "5";
		const got = parse(makeRunner(REAL_RUN_SH).run(spec({ cwd: dir, budgetMin: 0.01 })));
		assert.equal(got.reply, "timeout: budget of 0.01m exceeded");
		assert.equal(got.exit, 124, "timeout's 124 was replaced by the wrapper's own code");
		assert.deepEqual(
			got.usage,
			{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
			"usage on the timeout path does not carry the keys success carries",
		);
	});

	test("a budget of 0 is refused before anything starts", () => {
		const dir = temp("fractal-real-");
		process.env.FRACTAL_PI_BIN = FAKE_CLI;
		const got = parse(makeRunner(REAL_RUN_SH).run(spec({ cwd: dir, budgetMin: 0, task: "hi" })));
		assert.match(String(got.reply), /budget-min must be greater than 0/);
		assert.equal(got.exit, null, "a run that never started reported a child's code");
		assert.deepEqual(got.usage, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
	});

	// why: the escaper is gone, so the only thing quoting the cwd is node. A path with a
	// space is where that shows: sh must receive one argument, not two.
	test("a cwd with a space in it survives the trip to sh", () => {
		const dir = temp("fractal real ");
		process.env.FRACTAL_PI_BIN = FAKE_CLI;
		const cwdFile = join(dir, "cwd.txt");
		process.env.FRACTAL_FAKE_CWD = cwdFile;
		const got = parse(makeRunner(REAL_RUN_SH).run(spec({ cwd: dir, task: "hello" })));
		assert.equal(got.exit, 0, `the run failed: ${got.reply}`);
		assert.equal(readFileSync(cwdFile, "utf8").trim().endsWith(basename(dir)), true);
	});

	test("the task reaches the CLI byte for byte, off stdin", () => {
		const dir = temp("fractal-real-");
		const argvFile = join(dir, "argv.txt");
		process.env.FRACTAL_PI_BIN = FAKE_CLI;
		process.env.FRACTAL_FAKE_ARGV = argvFile;
		const nasty = 'say ok "dq" 100% $DOLLAR & amp | pipe ^caret';
		const got = parse(makeRunner(REAL_RUN_SH).run(spec({ cwd: dir, task: nasty })));
		assert.equal(got.exit, 0, `the run failed: ${got.reply}`);
		const argv = readFileSync(argvFile, "utf8").split("\n");
		assert.equal(argv[argv.length - 2], nasty, "the task was re-split on its way to the CLI");
	});

	// why: the tool as registered resolves its own path from FRACTAL_HOME. Nothing else here
	// exercises that path, and it is the one production uses; a wrapper that only works when
	// a test hands it a script is not a binding.
	test("the registered tool reaches cmd/run.sh through FRACTAL_HOME, with no override", async () => {
		const dir = temp("fractal-real-");
		delete process.env.FRACTAL_RUN_SH;
		process.env.FRACTAL_HOME = fileURLToPath(new URL("../..", import.meta.url));
		process.env.FRACTAL_PI_BIN = FAKE_CLI;
		const out = await makeFractalRunTool().execute(
			"id",
			spec({ cwd: dir, task: "hello" }),
			undefined,
			null,
			{ cwd: dir },
		);
		const got = parse(out.content[0].text);
		assert.equal(got.exit, 0, `the default path did not run the script: ${got.reply}`);
		assert.equal(got.reply, "fake reply from pi");
		assert.deepEqual(got.usage, {
			input: 30,
			output: 7,
			cacheRead: 9,
			cacheWrite: 12,
			cost: 0.003,
		});
	});
});

function piReady(): string | undefined {
	try {
		runBin("pi", ["--version"]);
	} catch {
		return "pi is not on PATH";
	}
	try {
		const out = runBin("pi", ["auth", "check", "--provider", "openai-codex", "--json"]);
		const status = (JSON.parse(out.trim()) as { status?: string }).status;
		if (status !== "ready") return `the openai-codex provider is not ready: ${status}`;
	} catch {
		return "the openai-codex provider is not configured";
	}
	return undefined;
}

describe("the real pi binary", () => {
	// why: the fakes never start a model, so nothing else proves the flags run.sh passes are
	// the ones pi accepts, or that pi's NDJSON is the shape the parser reads. This is the only
	// test that starts a real agent; it is skipped, by name, when pi or the provider is gone.
	test("gpt-5.6-luna answers through cmd/run.sh, and its usage is metered", (t) => {
		const why = piReady();
		if (why) return t.skip(why);
		const dir = temp("fractal-live-");
		const got = parse(
			makeRunner(REAL_RUN_SH).run({
				runner: "pi",
				model: "gpt-5.6-luna",
				budgetMin: 2,
				cwd: dir,
				task: "Reply with exactly the word: ready",
			}),
		);
		assert.equal(got.exit, 0, `the live run failed: ${got.reply}`);
		assert.match(String(got.reply), /ready/i);
		const usage = got.usage as { input: number; output: number };
		assert.ok(usage.input > 0, `input tokens were not metered: ${JSON.stringify(usage)}`);
		assert.ok(usage.output > 0, `output tokens were not metered: ${JSON.stringify(usage)}`);
	});
});
