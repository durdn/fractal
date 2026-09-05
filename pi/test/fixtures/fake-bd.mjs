#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

// why: execFileSync on Windows cannot run a .mjs, so tests launch this module with
// `node --import` and node rewrites argv[1] into a resolved path; both shapes are read.
const raw = process.argv.slice(1);
const args =
	raw[0] && basename(raw[0]) === "fake-bd.mjs"
		? raw.slice(1)
		: raw.map((a, i) => (i === 0 ? basename(a) : a));

const logPath = process.env.FRACTAL_FAKE_LOG;
const statePath = process.env.FRACTAL_FAKE_STATE;
const state =
	statePath && existsSync(statePath)
		? JSON.parse(readFileSync(statePath, "utf8"))
		: { items: [], calls: 0, created: 0 };
state.calls = (state.calls || 0) + 1;
if (logPath)
	appendFileSync(
		logPath,
		`${JSON.stringify(args)}
`,
	);

const save = () => {
	if (statePath) writeFileSync(statePath, JSON.stringify(state));
};
const out = (text, status = 0) => {
	(status === 0 ? process.stdout : process.stderr).write(text);
	save();
	process.exit(status);
};
const json = (value, status = 0) => out(JSON.stringify(value), status);
const flag = (name) => {
	const i = args.indexOf(name);
	return i === -1 ? undefined : args[i + 1];
};
const labels = (name) => (flag(name) || "").split(",").filter(Boolean);
// why: real bd merges --metadata into what is there and keeps a JSON array an array,
// unlike --set-metadata which stores every value as a string. The fake does both.
const mergeMetadata = (item) => {
	item.metadata = item.metadata || {};
	const raw = flag("--metadata");
	if (raw) Object.assign(item.metadata, JSON.parse(raw));
	for (let i = 0; i < args.length; i++) {
		if (args[i] !== "--set-metadata") continue;
		const [k, ...rest] = String(args[i + 1]).split("=");
		item.metadata[k] = rest.join("=");
	}
	if (Object.keys(item.metadata).length === 0) delete item.metadata;
};

const lockFails = Number(process.env.FRACTAL_FAKE_LOCK_FAIL || 0);
if (state.calls <= lockFails) out("bd: database is locked by another process\n", 1);

if (args[0] === "list") {
	const all = args.includes("--all");
	json(state.items.filter((i) => all || i.status !== "closed"));
}
if (args[0] === "show") {
	const item = state.items.find((i) => i.id === args[1]);
	if (!item) json({ error: `no such issue ${args[1]}` }, 1);
	json([item]);
}
if (args[0] === "create") {
	state.created += 1;
	const id = `bd-${state.created}`;
	const item = {
		id,
		title: args[1],
		status: "open",
		priority: 2,
		issue_type: flag("-t") || "task",
		comment_count: 0,
	};
	const parent = flag("--parent");
	if (parent) item.parent = parent;
	const ls = labels("-l");
	if (ls.length) item.labels = ls;
	const estimate = flag("-e");
	if (estimate) item.estimated_minutes = Number(estimate);
	mergeMetadata(item);
	state.items.push(item);
	out(args.includes("--silent") ? `${id}\n` : JSON.stringify(item));
}
if (args[0] === "comment") {
	const item = state.items.find((i) => i.id === args[1]);
	if (!item) json({ error: `no such issue ${args[1]}` }, 1);
	item.comment_count += 1;
	item.last_comment = args[2];
	out("");
}
if (args[0] === "update") {
	const item = state.items.find((i) => i.id === args[1]);
	if (!item) json({ error: `no such issue ${args[1]}` }, 1);
	const status = flag("-s");
	if (status) item.status = status;
	const added = labels("--add-label");
	if (added.length) item.labels = [...new Set([...(item.labels || []), ...added])].sort();
	const estimate = flag("-e");
	if (estimate) item.estimated_minutes = Number(estimate);
	mergeMetadata(item);
	out("");
}
json({ error: `unknown command ${args[0]}` }, 1);
