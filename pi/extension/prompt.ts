import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// why: the package is installed from the fractal checkout, so the home is two levels up
// from this file. The env var wins when set; the fallback spares a fresh shell the trap.
export function packageHome(here: string = import.meta.url): string {
	return resolve(dirname(fileURLToPath(here)), "..", "..");
}

export function fractalHome(
	env: NodeJS.ProcessEnv = process.env,
	fallback: string = packageHome(),
): string {
	const home = env.FRACTAL_HOME;
	if (home) return home;
	if (existsSync(resolve(fallback, "spec.md"))) return fallback;
	throw new Error(
		"FRACTAL_HOME is not set and no spec.md sits beside this package. Set it to the directory holding spec.md and code-axis.md.",
	);
}

function verbatimBlock(banner: string, label: string, text: string): string {
	return [
		banner,
		`(source: ${label}, verbatim, to be used and never paraphrased)`,
		"```",
		text,
		"```",
	].join("\n");
}

function readSpecAxis(
	home: string,
	read: (path: string) => string,
): { spec: string; axis: string } {
	return { spec: read(`${home}/spec.md`), axis: read(`${home}/code-axis.md`) };
}

function axisBlock(axis: string): string {
	return verbatimBlock(
		"THE CODE AXIS IS USED, NOT REPHRASED.",
		"code-axis.md, from $FRACTAL_HOME",
		axis,
	);
}

function blocks(spec: string, axis: string): string {
	return [
		verbatimBlock("THE SPEC IS USED, NOT REPHRASED.", "spec.md, from $FRACTAL_HOME", spec),
		axisBlock(axis),
	].join("\n\n");
}

export function specBlocks(home: string, read: (path: string) => string): string {
	const { spec, axis } = readSpecAxis(home, read);
	return blocks(spec, axis);
}

// why: every lead so far paraphrased the spec into the tasks it wrote. This prepends the
// files verbatim onto the child's own task text, in code, so paraphrase stops being a choice
// a lead can make. Who reads what is the spec's rule: a lead or senior takes both files
// whole; a scout, worker or verifier takes the axis, which holds the lines that bind its
// step. Mutating input in place is how pi's tool_call patches a call.
const STEP_ROLES = new Set(["fractal-scout", "fractal-worker", "fractal-verifier"]);

export function injectSpec(
	input: Record<string, unknown>,
	home: string,
	read: (path: string) => string,
): boolean {
	const agent = input.agent;
	const task = input.task;
	if (typeof agent !== "string" || !agent.startsWith("fractal-")) return false;
	if (typeof task !== "string") return false;
	const { spec, axis } = readSpecAxis(home, read);
	if (task.includes(axis)) return false;
	input.task = STEP_ROLES.has(agent)
		? `${axisBlock(axis)}\n\n${task}`
		: `${blocks(spec, axis)}\n\n${task}`;
	return true;
}

export function buildProcessPrompt(
	intent: string,
	home: string,
	read: (path: string) => string,
): string {
	return [
		`Intent: ${intent}`,
		specBlocks(home, read),
		"You are the process: plan by default, delegate independent work, judge the evidence. Add a planning child only for uncertain decomposition or a requested challenge. User scope governs.",
	].join("\n\n");
}
