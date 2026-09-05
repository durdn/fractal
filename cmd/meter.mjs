#!/usr/bin/env node
// cmd/meter.mjs: the meter over the files changed since a base commit.
// Lizard's languages (py, js, mjs, ts, go and the rest of its list) go to
// lizard for cyclomatic complexity; .sh gets `sh -n` plus a line count; .md
// is skipped and named on stdout. Node, no dependencies.
//
// touched surface: this file is new. codegraph query "meter.mjs" -p cmd and
// codegraph callers meter -p cmd (run against the root's index, before this
// file existed) both come back empty of it: the one "meter" hit is an
// unrelated object field in cmd/run-parse.mjs's parsePi. No real caller yet.
//
// usage: node cmd/meter.mjs [--base <commit>] [--ccn <n>]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// why: same Windows-safe shape as spawnGit in worktree.mjs (a .cmd shim needs
// cmd.exe; args stay an array so cmd.exe quotes each itself); cmd/ owns its
// own copy of this shape per file, never a shared import, so it imports no
// harness. Never throws on a non-zero exit: sh -n and lizard both use their
// exit code as a signal, not a crash.
function spawn(cmd, args, cwd) {
	const opts = { cwd, encoding: "utf8", shell: false };
	const r =
		process.platform === "win32"
			? spawnSync("cmd.exe", ["/c", cmd, ...args], opts)
			: spawnSync(cmd, args, opts);
	if (r.error) throw r.error;
	return r;
}

function git(args, cwd) {
	const r = spawn("git", args, cwd);
	if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
	return (r.stdout ?? "").trim();
}

// why: asking lizard for its version to see whether it exists costs a process
// and reports a missing binding as a crash; same onPath shape as init.mjs,
// cmd/ owns its own copy.
function onPath(bin) {
	const exts = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD").split(";") : [];
	for (const dir of (process.env.PATH ?? "").split(delimiter)) {
		if (!dir) continue;
		for (const ext of ["", ...exts]) if (existsSync(join(dir, bin + ext))) return true;
	}
	return false;
}

// why: on master there is no merge-base with master worth diffing (it is
// HEAD itself), so the contract falls back to the last commit there.
function defaultBase(cwd) {
	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
	return branch === "master" ? "HEAD~1" : git(["merge-base", "HEAD", "master"], cwd);
}

// why: one git call for line counts, with --no-renames so a rename reads as
// a deletion plus an addition, never as "no changed content"; numstat marks
// an unchanged rename (a pure mode flip, say) 0/0, which the filter drops,
// and a deleted file by its own name-status pass below.
function changedFiles(base, cwd) {
	const deleted = new Set(
		git(["diff", "--no-renames", "--name-only", "--diff-filter=D", base], cwd)
			.split(/\r?\n/)
			.filter(Boolean),
	);
	return git(["diff", "--no-renames", "--numstat", base], cwd)
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [added, del, path] = line.split("\t");
			return { path, added, del };
		})
		.filter((f) => f.added !== "-" && !deleted.has(f.path) && !(f.added === "0" && f.del === "0"));
}

// why: lizard's --csv quotes the long name field, which holds the parameter
// list and so can hold commas itself; a plain split(",") would cut it apart.
function parseCsvLine(line) {
	const out = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (quoted) {
			if (c === '"' && line[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			out.push(field);
			field = "";
		} else field += c;
	}
	out.push(field);
	return out;
}

function lineCount(path, cwd) {
	const text = readFileSync(join(cwd, path), "utf8");
	return text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
}

export function meter({ base, ccn = 10 } = {}, cwd = ".") {
	const at = base ?? defaultBase(cwd);
	const files = changedFiles(at, cwd);

	const lines = [];
	let over = false;
	const lizardFiles = [];

	for (const f of files) {
		const ext = extname(f.path).toLowerCase();
		if (ext === ".md") {
			lines.push(`skip ${f.path} (markdown)`);
		} else if (ext === ".sh") {
			const r = spawn("sh", ["-n", f.path], cwd);
			if (r.status !== 0) over = true;
			lines.push(`${f.path}: sh -n ${r.status === 0 ? "ok" : "FAILED"}, ${lineCount(f.path, cwd)} lines`);
		} else {
			lizardFiles.push(f.path);
		}
	}

	let fileCount = 0;
	let funcCount = 0;
	let maxCcn = 0;
	let totalNloc = 0;

	if (lizardFiles.length) {
		if (!onPath("lizard")) throw new Error("lizard missing from PATH: uv tool install lizard");
		const r = spawn("lizard", ["--csv", ...lizardFiles], cwd);
		const seen = new Set();
		for (const row of (r.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
			const [nloc, rowCcn, , , , , file, name] = parseCsvLine(row);
			seen.add(file);
			funcCount++;
			totalNloc += Number(nloc);
			maxCcn = Math.max(maxCcn, Number(rowCcn));
			if (Number(rowCcn) > ccn) {
				over = true;
				lines.push(`${file}: ${name} ccn ${rowCcn} nloc ${nloc}`);
			}
		}
		fileCount = seen.size;
	}

	lines.push(`files ${fileCount} functions ${funcCount} max ccn ${maxCcn} total nloc ${totalNloc}`);
	return { lines, code: over ? 1 : 0 };
}

// why: the module is imported by its own test, so the CLI half only fires
// when node was pointed at this file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const opts = {};
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--base") opts.base = args[++i];
		else if (args[i] === "--ccn") opts.ccn = Number(args[++i]);
	}
	try {
		const { lines, code } = meter(opts);
		for (const line of lines) console.log(line);
		process.exit(code);
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
