#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
// why: a fake cmd/run.sh for runner.test.ts. execFileSync/spawnSync on Windows cannot run
// a .sh or a .mjs directly, so the tests point FRACTAL_RUN_SH at node itself and launch
// this with `node --import`, which rewrites argv[1] into a resolved path; both shapes are
// read, exactly as fake-bd.mjs does.
import { basename } from "node:path";

const raw = process.argv.slice(1);
const args =
	raw[0] && basename(raw[0]) === "fake-run-sh.mjs"
		? raw.slice(1)
		: raw.map((a, i) => (i === 0 ? basename(a) : a));

const argvPath = process.env.FRACTAL_FAKE_RUNSH_ARGV;
if (argvPath) writeFileSync(argvPath, JSON.stringify(args));

const [runner = "", model = ""] = args;

// why: the task comes on stdin now, never on the command line. Reading it here is what
// proves the wrapper sent it: nothing else in the fixture can see it.
function readTask() {
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}
const task = readTask();
const line = (extra) =>
	JSON.stringify({
		runner,
		model,
		seconds: 2,
		reply: `fake run.sh reply${task ? `: ${task}` : ""}`,
		usage: { input: 11, output: 3, cacheRead: 0, cacheWrite: 0, cost: 0.5 },
		exit: 0,
		...extra,
	});

// why: sleep without a timer, so the process really burns wall clock before it exits and
// the elapsed seconds runner.ts measures are not zero.
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

switch (process.env.FRACTAL_FAKE_RUNSH ?? "ok") {
	case "fail":
		// why: this is run.sh's failure contract: one JSON line on stdout AND exit 1.
		// runBin throws on the exit code, so the wrapper never sees this line.
		process.stdout.write(`${line({ reply: "timeout: budget of 1m exceeded", exit: 124 })}\n`);
		process.stderr.write("run.sh: the run failed\n");
		process.exit(1);
		break;
	case "slow-fail":
		sleep(1200);
		process.stderr.write("run.sh: slow failure\n");
		process.exit(1);
		break;
	case "silent-fail":
		// why: no stderr at all; runBin then throws with its own "exited with status" text.
		process.exit(2);
		break;
	default:
		process.stdout.write(`${line({})}\n\n`);
		process.exit(0);
}
