#!/usr/bin/env node
// cmd/enforce-writes.mjs: a commit-msg hook. Rejects a commit whose subject is not
// 'type: item: message', or whose staged files fall outside the item's
// metadata.claims, walking the item's parent chain when it has none. Node, no
// dependencies; bd and git are the only bindings.
//
// usage: node cmd/enforce-writes.mjs <msg-file>   (run as the commit-msg hook)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// why: the item id carries the repo's own prefix, which bd derives from the directory name;
// `bd show` is the check that the item exists, so the regex only fixes the shape.
const SUBJECT = /^(feat|fix|maint|log|doc|spec|port): ([a-z][a-z0-9-]*-[a-z0-9.]+): .+$/;

export function parseSubject(subject) {
	const m = SUBJECT.exec(subject.trim());
	return m ? { type: m[1], item: m[2] } : null;
}

// why: same Windows-safe shape as run() in init.mjs, but this one never throws on a
// missing binary: status and error both come back so bdShow can report one message.
function spawnBinding(bin, args, cwd) {
	const opts = { cwd, encoding: "utf8", shell: false };
	return process.platform === "win32"
		? spawnSync("cmd.exe", ["/c", bin, ...args], opts)
		: spawnSync(bin, args, opts);
}

// why: bd show --json answers a one-element array, not an object; every caller wants
// the item, not the wrapper.
export function bdShow(id, cwd) {
	const r = spawnBinding("bd", ["show", id, "--json"], cwd);
	if (r.error) throw new Error(`bd show ${id}: ${r.error.message}`);
	if (r.status !== 0) throw new Error(`bd show ${id}: ${(r.stderr || r.stdout || "").trim()}`);
	let items;
	try {
		items = JSON.parse(r.stdout);
	} catch {
		throw new Error(`bd show ${id}: not JSON: ${r.stdout.trim()}`);
	}
	const item = Array.isArray(items) ? items[0] : items;
	if (!item) throw new Error(`bd show ${id}: no such item`);
	return item;
}

export function stagedFiles(cwd) {
	const r = spawnSync("git", ["diff", "--cached", "--name-only"], {
		cwd,
		encoding: "utf8",
		shell: false,
	});
	if (r.status !== 0) throw new Error(`git diff --cached: ${(r.stderr || "").trim()}`);
	return r.stdout.split(/\r?\n/).filter(Boolean);
}

// why: a claim is a path, or `name:<resource>` for a thing one writer holds at a time,
// which no diff can show; the hook checks paths and leaves a Name to the tracker's own
// atomic claim. .beads/*.jsonl is the tracker's own write, always allowed.
export const isPathClaim = (claim) => !claim.startsWith("name:");

export function isAllowed(path, claims) {
	if (/^\.beads\/[^/]+\.jsonl$/.test(path)) return true;
	return claims
		.filter(isPathClaim)
		.some((w) => path === w || path.startsWith(`${w.replace(/\/+$/, "")}/`));
}

// why: an item with no claims of its own defers to its parent, so pattern's
// epic-level commits work without the epic repeating a step's claims. Items written
// before 28/08/2026 carry the same list under `writes`.
export function resolveClaims(id, cwd) {
	let current = id;
	for (;;) {
		const item = bdShow(current, cwd);
		const claims = item.metadata?.claims ?? item.metadata?.writes;
		if (claims && claims.length) return claims;
		if (!item.parent) return null;
		current = item.parent;
	}
}

export function check(msgFile, cwd) {
	const subject = readFileSync(msgFile, "utf8").split(/\r?\n/)[0] ?? "";
	const parsed = parseSubject(subject);
	if (!parsed)
		return {
			code: 1,
			stderr: [
				`enforce-writes: bad subject: ${subject}`,
				"enforce-writes: want type: item: message; type in feat fix maint log doc spec port",
			],
		};

	let claims;
	try {
		claims = resolveClaims(parsed.item, cwd);
	} catch (error) {
		return { code: 1, stderr: [`enforce-writes: ${error.message}`] };
	}
	if (!claims) {
		return {
			code: 0,
			stderr: [`enforce-writes: no claims on ${parsed.item} or its parents; staged paths not checked`],
		};
	}

	let staged;
	try {
		staged = stagedFiles(cwd);
	} catch (error) {
		return { code: 1, stderr: [`enforce-writes: ${error.message}`] };
	}
	const offending = staged.filter((path) => !isAllowed(path, claims));
	if (offending.length) {
		return {
			code: 1,
			stderr: [
				`enforce-writes: outside ${parsed.item}'s claims: ${offending.join(", ")}`,
				`enforce-writes: claims: ${claims.join(", ")}`,
			],
		};
	}
	return { code: 0, stderr: [] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const msgFile = process.argv[2];
	if (!msgFile) {
		console.error("usage: enforce-writes.mjs <msg-file>");
		process.exit(1);
	}
	const { code, stderr } = check(msgFile, process.cwd());
	for (const line of stderr) console.error(line);
	process.exit(code);
}
