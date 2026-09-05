#!/usr/bin/env node
// install.mjs: one install, on a blank box and a blank project. Puts the
// tracker and the indexer bindings on the path, then deploys fractal into the
// agents this box has. No admin rights, no box path: it computes its own.
//
// usage: node install.mjs [--claude-code | --pi | --codex] [--uninstall] [--help]
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { onPath, run } from "./cmd/init.mjs";
import { deploy as codexSkill } from "./codex/install.mjs";

const home = dirname(fileURLToPath(import.meta.url));

function version(bin) {
	try {
		return (run(bin, ["--version"]).match(/\d+\.\d+\.\d+/) ?? ["unknown"])[0];
	} catch {
		return "unknown";
	}
}

// why: the interface is named first on every line, and the tool second, because the tool is
// the part that may be replaced and the part the user never has to type.
function binding({ name, binding: tool, bin, pkg, telemetry }) {
	if (onPath(bin)) return `${name}: ready (${tool} ${version(bin)})`;
	run("npm", ["install", "-g", pkg]);
	// why: telemetry goes off the moment the binding lands, before it has anything to send.
	// A binding that moved its switch is still installed, so this never fails the install.
	try {
		run(bin, telemetry);
	} catch {}
	return `${name}: installed (${tool} ${version(bin)})`;
}

const BINDINGS = [
	{
		name: "tracker",
		binding: "beads",
		bin: "bd",
		pkg: "@beads/bd",
		telemetry: ["metrics", "off"],
	},
	{
		name: "indexer",
		binding: "codegraph",
		bin: "codegraph",
		pkg: "@colbymchenry/codegraph",
		telemetry: ["telemetry", "off"],
	},
];

// why: the Claude Code half is already a script and it does junctions and frontmatter that
// node would only reimplement. It needs sh; when there is none, that is a reported skip and
// not a failed install, because the pi half may still be all this box wants.
function claudeCode(uninstall) {
	if (!onPath("claude"))
		return "claude code: skipped (claude is not on the path)";
	if (!onPath("sh"))
		return "claude code: skipped (claude-code/install.sh needs sh on the path)";
	const script = join(home, "claude-code", "install.sh").replaceAll("\\", "/");
	run("sh", uninstall ? [script, "--uninstall"] : [script]);
	return uninstall
		? "claude code: removed"
		: "claude code: installed (skill and agents)";
}

function piPackage(uninstall) {
	if (!onPath("pi")) return "pi: skipped (pi is not on the path)";
	const pkg = join(home, "pi");
	if (uninstall) {
		run("pi", ["uninstall", pkg]);
		return "pi: removed";
	}
	const installed = run("pi", ["list"]).includes(pkg);
	run("pi", ["install", pkg]);
	return installed ? "pi: ready (fractal-pi)" : "pi: installed (fractal-pi)";
}

const USAGE = `usage: node install.mjs [--claude-code | --pi | --codex] [--uninstall] [--help]

Installs the tracker and indexer bindings if absent, then deploys fractal into
Claude Code, pi and Codex when detected. Deployment flags select only those
harnesses (flags may be combined); --codex also supports app-only installations.
Codex links ~/.agents/skills/fractal to this checkout; no config changes.
--uninstall removes the deployments; the bindings hold your data,
so they are left in place.`;

export function parse(argv) {
	const selected = argv.some((arg) =>
		["--claude-code", "--pi", "--codex"].includes(arg),
	);
	const opts = {
		claudeCode: !selected,
		pi: !selected,
		codex: !selected,
		uninstall: false,
		explicitCodex: false,
	};
	for (const arg of argv) {
		if (arg === "--help") return null;
		if (arg === "--uninstall") opts.uninstall = true;
		else if (arg === "--claude-code") opts.claudeCode = true;
		else if (arg === "--pi") opts.pi = true;
		else if (arg === "--codex") opts.codex = opts.explicitCodex = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	return opts;
}

export function install(opts) {
	const lines = opts.uninstall ? [] : BINDINGS.map(binding);
	if (opts.claudeCode) lines.push(claudeCode(opts.uninstall));
	if (opts.pi) lines.push(piPackage(opts.uninstall));
	if (opts.codex) {
		const detected = onPath("codex") || existsSync(join(homedir(), ".codex"));
		lines.push(
			opts.uninstall || opts.explicitCodex || detected
				? codexSkill({ uninstall: opts.uninstall })
				: "codex: skipped (not detected; use --codex for app-only installs)",
		);
	}
	if (!opts.uninstall) {
		lines.push("", "Restart your harness if the skill does not appear.");
		lines.push(
			"In any repo: /fractal <intent> (Claude Code/pi); $fractal <intent> (Codex)",
		);
	}
	return lines;
}

function main(argv) {
	const opts = parse(argv);
	if (!opts) return console.log(USAGE);
	if (!existsSync(join(home, "spec.md")))
		throw new Error(`no spec.md under ${home}`);
	for (const line of install(opts)) console.log(line);
}

// why: the same guard cmd/init.mjs uses, so importing install() runs no install.
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		main(process.argv.slice(2));
	} catch (error) {
		console.error(`fractal: ${error.message}`);
		process.exit(1);
	}
}
