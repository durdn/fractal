import { initTracker } from "../../cmd/init.mjs";
import { type Conventions, type Item, runBin, type Tracker } from "./types.ts";

function str(v: unknown): string {
	return typeof v === "string" ? v : v == null ? "" : String(v);
}
function strOrUndef(v: unknown): string | undefined {
	return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number {
	if (typeof v === "number") return v;
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}
function meta(v: unknown): Record<string, unknown> | undefined {
	return typeof v === "object" && v ? (v as Record<string, unknown>) : undefined;
}
function labelList(v: unknown): string[] | undefined {
	return Array.isArray(v) ? v.filter((x) => typeof x === "string") : undefined;
}
function numOrUndef(v: unknown): number | undefined {
	const n = Number(v);
	return v == null || !Number.isFinite(n) ? undefined : n;
}

// why: the five labels the code axis names, in one order, so a tree reads the same everywhere.
function conventionLabels(c: Conventions): string[] {
	const out: string[] = [];
	if (c.step) out.push(`step:${c.step}`);
	if (c.by) out.push(`by:${c.by}`);
	if (c.axis) out.push(`axis:${c.axis}`);
	if (c.grade) out.push(`grade:${c.grade}`);
	return out;
}

// why: every reader iterates metadata.writes as a list, and bd's --set-metadata k=v stores
// every value as a string, so writes would come back as "[\"a.py\"]" and iterate as
// characters. bd's --metadata takes a JSON object, keeps the array an array, and merges
// into existing metadata on update. One flag, both commands.
function metadataArg(c: Conventions, extra?: Record<string, unknown>): string | undefined {
	const m: Record<string, unknown> = { ...extra };
	if (c.artifact) m.artifact = c.artifact;
	if (c.failure) m.failure = c.failure;
	if (c.writes?.length) m.writes = c.writes;
	return Object.keys(m).length ? JSON.stringify(m) : undefined;
}

export function toItem(raw: unknown): Item {
	// why: bd names the type field issue_type, omits keys it has no value for, and a
	// missing row must map to an empty item rather than throw.
	const r = (raw ?? {}) as Record<string, unknown>;
	return {
		id: str(r.id),
		title: str(r.title),
		status: str(r.status),
		priority: num(r.priority),
		issue_type: str(r.issue_type),
		parent: strOrUndef(r.parent),
		started_at: strOrUndef(r.started_at),
		comment_count: num(r.comment_count),
		labels: labelList(r.labels),
		estimated_minutes: numOrUndef(r.estimated_minutes),
		metadata: meta(r.metadata),
	};
}

function errText(e: unknown): string {
	const err = e as { stderr?: string; message?: string };
	return err.stderr ?? err.message ?? "";
}

function failure(cmd: string, args: string[], stderr: string): Error {
	return new Error(`${cmd} ${args.join(" ")} failed: ${stderr}`);
}

function run(cmd: string, args: string[]): string {
	try {
		return runBin(cmd, args);
	} catch (e) {
		const stderr = errText(e);
		// why: bd can fail on a lock held by another process; retry once, nothing else.
		if (!/lock/i.test(stderr)) throw failure(cmd, args, stderr);
		try {
			return runBin(cmd, args);
		} catch (e2) {
			throw failure(cmd, args, errText(e2));
		}
	}
}

export function makeTracker(bin?: string): Tracker {
	const cmd = bin ?? process.env.FRACTAL_BD_BIN ?? "bd";
	return {
		async init(cwd) {
			return initTracker(cwd);
		},
		async list(o) {
			const args = ["list", "--json"];
			if (o?.all) args.push("--all");
			const raw = JSON.parse(run(cmd, args)) as unknown[];
			return raw.map(toItem);
		},
		async export() {
			// why: export hands out the tracker's own JSON, not Item[], for any reader of the tree.
			return run(cmd, ["list", "--json", "--all"]);
		},
		async show(id) {
			// why: bd show --json takes ids plural and wraps a single result in an array.
			const [first] = JSON.parse(run(cmd, ["show", id, "--json"])) as unknown[];
			return toItem(first);
		},
		async create(title, o) {
			const args = ["create", title];
			if (o.type) args.push("-t", o.type);
			if (o.parent) args.push("--parent", o.parent);
			if (o.description) args.push("-d", o.description);
			const labels = conventionLabels(o);
			if (labels.length) args.push("-l", labels.join(","));
			if (o.estimateMin !== undefined) args.push("-e", String(o.estimateMin));
			const metadata = metadataArg(o);
			if (metadata) args.push("--metadata", metadata);
			args.push("--silent");
			return run(cmd, args).trim();
		},
		async comment(id, text) {
			run(cmd, ["comment", id, text]);
		},
		async update(id, o) {
			const args = ["update", id];
			if (o.status) args.push("-s", o.status);
			const labels = conventionLabels(o);
			// why: bd update has no -l; --add-label adds without dropping what is there.
			if (labels.length) args.push("--add-label", labels.join(","));
			if (o.estimateMin !== undefined) args.push("-e", String(o.estimateMin));
			const metadata = metadataArg(o, o.metadata);
			if (metadata) args.push("--metadata", metadata);
			run(cmd, args);
		},
	};
}
