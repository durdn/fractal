import { initIndexer } from "../../cmd/init.mjs";
import { type Indexer, runBin } from "./types.ts";

function run(cmd: string, args: string[]): string {
	return runBin(cmd, args);
}

export function makeIndexer(bin?: string): Indexer {
	const cmd = bin ?? process.env.FRACTAL_CODEGRAPH_BIN ?? "codegraph";
	return {
		async init(cwd) {
			return initIndexer(cwd);
		},
		async explore(q, path) {
			const args = ["explore", q];
			if (path) args.push("-p", path);
			// why: codegraph explore has no --json mode, unlike query; the asymmetry looks
			// like a bug to the next reader, it is not.
			return run(cmd, args);
		},
		async query(q, path) {
			const args = ["query", q];
			if (path) args.push("-p", path);
			args.push("--json");
			return JSON.parse(run(cmd, args));
		},
	};
}
