#!/usr/bin/env node
// cmd/fixtures/fake-tool.mjs: the fake tracker and indexer bindings for the init tests.
// Reached as `bd` and `codegraph` through the two .cmd shims beside it, which is how the
// real bindings arrive on Windows, so a test only has to put this folder on PATH.
//
//   FRACTAL_FAKE_LOG   file to append one JSON argv line per call
//   FRACTAL_FAKE_FAIL  tool name that should exit 3 with a message on stderr
import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const [tool, ...args] = process.argv.slice(2);
if (process.env.FRACTAL_FAKE_LOG) {
	appendFileSync(process.env.FRACTAL_FAKE_LOG, `${JSON.stringify([tool, ...args])}\n`);
}

if (process.env.FRACTAL_FAKE_FAIL === tool) {
	process.stderr.write(`${tool}: boom, the binding refused\n`);
	process.exit(3);
}

if (args[0] === "--version") process.stdout.write(`${tool} version 9.9.9\n`);

// why: the real bindings drop these markers and cmd/init.mjs reads them to stay idempotent,
// so the fake drops them too. Without that the second run would not be the no-op it claims.
if (args[0] === "init") {
	mkdirSync(tool === "bd" ? join(process.cwd(), ".beads") : join(resolve(args[1]), ".codegraph"), {
		recursive: true,
	});
}
