import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fractalHome } from "./prompt.ts";

export function agentDir(env: NodeJS.ProcessEnv = process.env): string {
	const base = env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
	return join(base, "agents");
}

// why: the role bodies live once, as $FRACTAL_HOME/roles/<role>.md, shared with every
// other harness. Only the frontmatter is pi's, so only the frontmatter is here.
const FRONTMATTER: Record<string, string[]> = {
	// why: no role carries a subagent_agents allowlist. Pattern spawns nothing and the
	// session is the process (spec.md); a lead that could spawn ran the loop itself and
	// judged, and the record proved it wrong (03/09/2026).
	// why: models as provider/id, never a nickname; a bare "opus" matched Bedrock first.
	// pi's defaults are OpenAI: sol with high thinking where judgment is, luna for scouts.
	"fractal-lead": ["model: openai-codex/gpt-5.6-sol", "thinking: high"],
	"fractal-scout": [
		"model: openai-codex/gpt-5.6-luna",
		"tools: read, grep, find, ls",
		"thinking: low",
		"auto-exit: true",
	],
	"fractal-senior": ["model: openai-codex/gpt-5.6-sol", "thinking: high", "auto-exit: true"],
	"fractal-verifier": ["model: openai-codex/gpt-5.6-sol", "thinking: medium", "auto-exit: true"],
	"fractal-worker": ["model: openai-codex/gpt-5.6-sol", "thinking: medium", "auto-exit: true"],
};

export function rolesDir(env: NodeJS.ProcessEnv = process.env, fallback?: string): string {
	return join(fractalHome(env, fallback), "roles");
}

// why: a body with no frontmatter row would install as a role pi cannot grade, so an
// unknown role stops the sync instead of shipping a headless file.
export function compose(role: string, body: string): string {
	const keys = FRONTMATTER[role];
	if (!keys) throw new Error(`fractal: no pi frontmatter for role ${role}`);
	return `---\nname: ${role}\n${keys.join("\n")}\n---\n\n${body}`;
}

function shouldWrite(target: string, content: string): boolean {
	return !existsSync(target) || readFileSync(target, "utf8") !== content;
}

export function syncAgents(env: NodeJS.ProcessEnv = process.env): string[] {
	const src = rolesDir(env);
	if (!existsSync(src)) return [];
	const dst = agentDir(env);
	mkdirSync(dst, { recursive: true });
	const written: string[] = [];
	for (const name of readdirSync(src)) {
		if (!name.endsWith(".md")) continue;
		const content = compose(name.slice(0, -3), readFileSync(join(src, name), "utf8"));
		const target = join(dst, name);
		if (!shouldWrite(target, content)) continue;
		writeFileSync(target, content);
		written.push(name);
	}
	return written;
}
