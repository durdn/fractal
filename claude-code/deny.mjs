#!/usr/bin/env node
// deny.mjs: the box's deny list into the Claude Code user settings, merged with
// what is there. Run by hand: a session's own write of settings.json is refused by
// the auto-mode classifier (04/09/2026). The rules are the axis
// line "this box denies in settings ... find / and a kill by name".
//
// usage: node claude-code/deny.mjs [--dest DIR]   (DIR defaults to ~/.claude)
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DENY = [
	"Bash(find /*)",
	"Bash(taskkill /IM *)",
	"Bash(taskkill * /IM *)",
	"Bash(taskkill /im *)",
	"Bash(taskkill * /im *)",
	"Bash(pkill *)",
	"Bash(killall *)",
	"Bash(*Stop-Process -Name*)",
	"PowerShell(taskkill /IM *)",
	"PowerShell(taskkill * /IM *)",
	"PowerShell(taskkill /im *)",
	"PowerShell(taskkill * /im *)",
	"PowerShell(Stop-Process -Name *)",
	"PowerShell(Stop-Process * -Name *)",
	"PowerShell(*| Stop-Process*)",
	"PowerShell(pkill *)",
	"PowerShell(killall *)",
];

const i = process.argv.indexOf("--dest");
const file = join(i > 0 ? process.argv[i + 1] : join(homedir(), ".claude"), "settings.json");
const settings = JSON.parse(readFileSync(file, "utf8"));
settings.permissions ??= {};
const have = new Set(settings.permissions.deny ?? []);
settings.permissions.deny = [...have, ...DENY.filter((r) => !have.has(r))];
writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`${file}: ${settings.permissions.deny.length} deny rules`);
