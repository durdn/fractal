#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Node resolves the installed junction/symlink before import.meta.url. No shell home.path.
export function runtime(env = process.env, userHome = homedir()) {
	const home = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const herdrSkill = join(
		userHome,
		".agents",
		"skills",
		"herdr-subagents",
		"SKILL.md",
	);
	const launcher = join(dirname(herdrSkill), "scripts", "codex-subagents.mjs");
	return {
		harness: "codex",
		version: readFileSync(join(home, "spec.md"), "utf8").match(
			/^v([^,]+),/m,
		)[1],
		home,
		spec: join(home, "spec.md"),
		axes: {
			code: join(home, "code-axis.md"),
			research: join(home, "research-axis.md"),
		},
		roles: join(home, "roles"),
		herdr: {
			available:
				env.HERDR_ENV === "1" && existsSync(herdrSkill) && existsSync(launcher),
			skill: herdrSkill,
			launcher,
		},
	};
}

if (
	process.argv[1] &&
	realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	console.log(JSON.stringify(runtime(), null, 2));
}
