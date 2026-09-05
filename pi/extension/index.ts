import { readFileSync } from "node:fs";
import { join } from "node:path";
import { overBudget } from "./budget.ts";
import { buildProcessPrompt, fractalHome, injectSpec } from "./prompt.ts";
import { agentDir, syncAgents } from "./roles.ts";
import { makeFractalRunTool } from "./runner.ts";
import { renderTree } from "./status.ts";
import { makeTracker } from "./tracker.ts";
import {
	type Item,
	type PiApi,
	type PiCtx,
	type PiTool,
	runBin,
	type ToolCallEvent,
	type ToolResult,
} from "./types.ts";

// why: the tracker and the indexer are ready before the lead prompt is built, so no user
// ever initializes either one. The skill runs the same command line, so there is one
// implementation of the op and one output; a child process keeps a missing binding from
// taking the session down with it.
export function initRepo(cwd: string, base: string): string {
	return runBin(process.execPath, [join(base, "cmd", "init.mjs"), cwd]);
}

export function syncOnActivate(
	report: (msg: string) => void = () => {},
	sync: () => string[] = syncAgents,
): string[] {
	try {
		return sync();
	} catch (error) {
		// why: a sync failure must not throw out of activation, and must not vanish either.
		// Without the role files every spawn fails later with an unrelated message.
		const cause = error instanceof Error ? error.message : String(error);
		report(`fractal: agent roles not synced to ${agentDir()}: ${cause}. Run /fractal-install.`);
		return [];
	}
}

// why: pi fires tool_call before the tool runs and hands over a mutable input, so the spec
// and the axis reach every fractal child by code, not by a lead remembering to paste them.
export function makeToolCallHook(
	home: (env?: NodeJS.ProcessEnv) => string = fractalHome,
	read: (path: string) => string = (path) => readFileSync(path, "utf8"),
): (event: ToolCallEvent) => void {
	return (event) => {
		if (event.toolName !== "subagent" || !event.input) return;
		try {
			injectSpec(event.input, home(), read);
		} catch {
			// why: a throw here blocks the tool. An unset FRACTAL_HOME or an unreadable spec
			// must leave the spawn alone, not cancel it.
		}
	};
}

export function makeFractalHandler(
	pi: PiApi,
	home: (env?: NodeJS.ProcessEnv) => string = fractalHome,
	init: (cwd: string, base: string) => string = initRepo,
): (args: string, ctx: PiCtx) => Promise<void> {
	return async (args, ctx) => {
		const intent = args.trim();
		if (!intent) {
			ctx.ui?.notify(
				"fractal: an intent is required, for example /fractal build the thing.",
				"warning",
			);
			return;
		}
		let base: string;
		try {
			base = home();
			init(ctx.cwd, base);
		} catch (error) {
			ctx.ui?.notify(error instanceof Error ? error.message : String(error), "error");
			return;
		}
		pi.sendUserMessage(buildProcessPrompt(intent, base, (path) => readFileSync(path, "utf8")));
	};
}

export function makeFractalInstallHandler(
	env: NodeJS.ProcessEnv = process.env,
): (args: string, ctx: PiCtx) => Promise<void> {
	return async (_args, ctx) => {
		try {
			const dir = agentDir(env);
			const written = syncAgents(env);
			const msg = written.length
				? `fractal-install: wrote ${written.join(", ")} to ${dir}`
				: `fractal-install: ${dir} already up to date`;
			ctx.ui?.notify(msg, "info");
		} catch (error) {
			// why: this command is the retry path for a failed sync, so it must report the
			// reason, not throw out of the session.
			ctx.ui?.notify(error instanceof Error ? error.message : String(error), "error");
		}
	};
}

function scopeToRoot(items: Item[], root?: string): Item[] {
	if (!root) return items;
	const byId = new Map(items.map((item) => [item.id, item]));
	const isInScope = (item: Item): boolean => {
		let cur: Item | undefined = item;
		while (cur) {
			if (cur.id === root) return true;
			cur = cur.parent ? byId.get(cur.parent) : undefined;
		}
		return false;
	};
	return items.filter(isInScope);
}

export async function fractalStatusResult(root?: string): Promise<ToolResult> {
	const items = await makeTracker().list({ all: true });
	const scoped = scopeToRoot(items, root);
	const over = overBudget(scoped, Date.now());
	const overLines = over.map((o) => `OVER BUDGET: ${o.id} (${o.elapsedMin}/${o.budgetMin} min)`);
	const text = [renderTree(scoped), ...overLines].join("\n");
	return { content: [{ type: "text", text }], details: { items: scoped, over } };
}

export function makeFractalStatusTool(): PiTool {
	return {
		name: "fractal_status",
		label: "Fractal status",
		description: "Prints the fractal loop tree from the tracker, with over-budget items flagged.",
		parameters: {
			type: "object",
			properties: { root: { type: "string", description: "Tracker id to scope the tree to." } },
		},
		execute: (_id, params) => {
			const root = (params as { root?: unknown } | undefined)?.root;
			return fractalStatusResult(typeof root === "string" ? root : undefined);
		},
	};
}

export default function (pi: PiApi) {
	// why: pi refuses action calls while an extension loads, so the sync and its report
	// wait for session_start; a missing home then reports instead of crashing the load.
	pi.on("session_start", () =>
		syncOnActivate((msg) =>
			pi.sendMessage({ customType: "fractal-roles", content: msg, display: true }),
		),
	);
	const hook = makeToolCallHook();
	pi.on("tool_call", (event) => hook(event));
	pi.registerCommand("fractal", {
		description: "Run an intent as a fractal loop; this session becomes the process.",
		handler: makeFractalHandler(pi),
	});
	pi.registerCommand("fractal-install", {
		description: "Re-sync fractal agent roles to the global pi agent directory.",
		handler: makeFractalInstallHandler(),
	});
	pi.registerTool(makeFractalStatusTool());
	pi.registerTool(makeFractalRunTool());
}
