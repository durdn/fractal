import { spawnSync } from "node:child_process";

// why: a Windows .cmd/.bat shim (the tracker and indexer binaries, via scoop) cannot be exec'd by
// spawnSync/execFileSync; it must run through cmd.exe. Args stay an array on both
// branches so cmd.exe quotes each one itself — no shell:true, no string join, no
// injection surface for model-authored titles/comments containing quotes or `&`/`|`.
// Lives here, not in tracker.ts or indexer.ts, so neither binding imports the other.
export function runBin(cmd: string, args: string[]): string {
	const r =
		process.platform === "win32"
			? spawnSync("cmd.exe", ["/c", cmd, ...args], { encoding: "utf8" })
			: spawnSync(cmd, args, { encoding: "utf8" });
	if (r.error) throw r.error;
	if (r.status !== 0) {
		throw Object.assign(new Error(r.stderr || `${cmd} exited with status ${r.status}`), {
			stderr: r.stderr,
		});
	}
	return r.stdout ?? "";
}

export interface Item {
	id: string;
	title: string;
	status: string;
	priority: number;
	issue_type: string;
	parent?: string;
	started_at?: string;
	comment_count: number;
	labels?: string[];
	estimated_minutes?: number;
	metadata?: Record<string, unknown>;
}

// why: the seven conventions the code axis names, one shape every reader shares. Labels carry
// the step, the agent and the node tuple; --estimate carries the budget; metadata carries
// the outcome. Nothing here is prose.
export interface Conventions {
	step?: string;
	by?: string;
	axis?: string;
	grade?: string;
	estimateMin?: number;
	artifact?: string;
	failure?: string;
	writes?: string[];
}
export interface Tracker {
	// why: the op that readies a repo. Its commands live in cmd/init.mjs, once, so the skill's
	// command line and this binding cannot drift apart.
	init(cwd: string): Promise<string>;
	list(o?: { all?: boolean }): Promise<Item[]>;
	// why: the export op, every row as the checker reads it, raw, not mapped through toItem.
	export(): Promise<string>;
	show(id: string): Promise<Item>;
	create(
		title: string,
		o: { parent?: string; type?: string; description?: string } & Conventions,
	): Promise<string>;
	comment(id: string, text: string): Promise<void>;
	update(
		id: string,
		o: { status?: string; metadata?: Record<string, unknown> } & Conventions,
	): Promise<void>;
}
export interface Indexer {
	init(cwd: string): Promise<string>;
	explore(q: string, path?: string): Promise<string>;
	query(q: string, path?: string): Promise<unknown>;
}
export interface PiCtx {
	cwd: string;
	ui?: { notify(msg: string, level?: string): void };
}
export interface ToolResult {
	content: { type: "text"; text: string }[];
	details?: unknown;
}
export interface PiTool {
	name: string;
	label: string;
	description: string;
	parameters: object;
	execute(
		toolCallId: string,
		// why: pi validates params against the JSON Schema at runtime, so no static type is available.
		params: unknown,
		signal: AbortSignal | undefined,
		onUpdate: unknown,
		ctx: PiCtx,
	): Promise<ToolResult>;
}
export interface PiApi {
	registerTool(tool: PiTool): void;
	registerCommand(
		name: string,
		opts: { description?: string; handler: (args: string, ctx: PiCtx) => Promise<void> },
	): void;
	sendUserMessage(text: string): void;
	sendMessage(
		msg: { customType: string; content: string; display?: boolean; details?: unknown },
		opts?: { triggerTurn?: boolean; deliverAs?: string },
	): void;
	on(event: string, handler: (event: ToolCallEvent, ctx: unknown) => unknown): void;
}

// why: pi fires tool_call before a tool runs and lets a handler mutate event.input in
// place; that mutation is what the tool actually receives. See pi docs/extensions.md.
export interface ToolCallEvent {
	toolName: string;
	toolCallId?: string;
	input: Record<string, unknown>;
}
