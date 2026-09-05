import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fractalHome } from "./prompt.ts";
import type { PiTool } from "./types.ts";

export interface RunSpec {
	runner: string;
	model: string;
	budgetMin: number;
	cwd: string;
	task?: string;
}

export interface Runner {
	run(spec: RunSpec): string;
}

// why: resolved per call, not at registration. fractalHome() throws when FRACTAL_HOME is
// unset, and at registration that throw would take the whole extension down instead of one
// tool call. FRACTAL_RUN_SH is the override a test points at a fake script.
function scriptPath(script?: string): string {
	return script ?? process.env.FRACTAL_RUN_SH ?? join(fractalHome(), "cmd", "run.sh");
}

function argsOf(spec: RunSpec): string[] {
	return [spec.runner, spec.model, String(spec.budgetMin), spec.cwd];
}

// why: runBin serves neither need. It routes through cmd.exe on Windows, which cannot exec
// a .sh: it hangs on the file association, so the tool never reached cmd/run.sh. The
// interpreter is named instead, script first, anything else direct. And runBin discards
// stdout on a non-zero exit, which is exactly what run.sh needs to return: its JSON line.
// why: the task goes on stdin, never on the command line, so no quoting of it can be wrong
// and the escaper that guarded it is gone. What is left on the line is a runner name, a
// model, a number and a path, which node quotes correctly for sh.exe on its own.
function spawnScript(script: string, args: string[], task: string) {
	const sh = script.endsWith(".sh");
	const r = spawnSync(sh ? "sh" : script, sh ? [script, ...args] : args, {
		encoding: "utf8",
		input: task,
	});
	if (r.error) throw r.error;
	return r;
}

// why: run.sh's contract is one JSON line on stdout on every path, so on a failing exit that
// line is still the answer and nothing may stand in for it.
function jsonLine(out: string): string | undefined {
	try {
		return JSON.parse(out) instanceof Object ? out : undefined;
	} catch {
		return undefined;
	}
}

// why: only for a script that failed without printing its line: no usage, no child code.
// The keys are run.sh's own five, zeroed, so a caller never branches on the usage shape.
const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };

function failureLine(spec: RunSpec, cause: unknown, seconds: number): string {
	const { runner, model } = spec;
	const reply = cause instanceof Error ? cause.message : String(cause);
	return JSON.stringify({ runner, model, seconds, reply, usage: ZERO_USAGE, exit: 1 });
}

export function makeRunner(script?: string): Runner {
	return {
		run(spec) {
			const started = Date.now();
			const elapsed = () => Math.round((Date.now() - started) / 1000);
			try {
				const path = scriptPath(script);
				const got = spawnScript(path, argsOf(spec), spec.task ?? "");
				const line = (got.stdout ?? "").trim();
				if (got.status === 0) return line;
				const why = (got.stderr ?? "").trim() || `${path} exited with status ${got.status}`;
				return jsonLine(line) ?? failureLine(spec, new Error(why), elapsed());
			} catch (error) {
				return failureLine(spec, error, elapsed());
			}
		},
	};
}

function specOf(params: unknown): RunSpec {
	const p = (params ?? {}) as Record<string, unknown>;
	const task = p.task;
	return {
		runner: String(p.runner ?? ""),
		model: String(p.model ?? ""),
		budgetMin: Number(p.budgetMin ?? 0),
		cwd: String(p.cwd ?? ""),
		task: typeof task === "string" ? task : undefined,
	};
}

export function makeFractalRunTool(runner: Runner = makeRunner()): PiTool {
	return {
		name: "fractal_run",
		label: "Fractal run",
		description:
			"Starts one agent through cmd/run.sh and returns its JSON line: runner, model, seconds, reply, usage, exit.",
		parameters: {
			type: "object",
			properties: {
				runner: { type: "string", description: "Runner binding to start, such as pi or codex." },
				model: { type: "string", description: "Model the runner starts the agent with." },
				budgetMin: { type: "number", description: "Budget in minutes; over it the run fails." },
				cwd: { type: "string", description: "Working directory the agent runs in." },
				task: { type: "string", description: "Task text handed to the agent." },
			},
			required: ["runner", "model", "budgetMin", "cwd"],
		},
		execute: async (_id, params) => ({
			content: [{ type: "text", text: runner.run(specOf(params)) }],
		}),
	};
}
