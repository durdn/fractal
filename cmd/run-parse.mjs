#!/usr/bin/env node
// cmd/run-parse.mjs: run.sh's one writer of the JSON line. Reads a headless
// CLI's stdout and prints {"runner","model","seconds","reply","usage","exit"}.
// Escaping lives here so no shell ever quotes model output.
//
// usage: run-parse.mjs RUNNER MODEL SECONDS EXIT REASON [KEEP] <RAW
// EXIT is the child's own code, empty when no child ran, and goes into the line
// as it is so a caller can tell 124 (the budget) from the model. REASON empty
// means RAW holds a real answer; anything else is a failure and becomes the
// reply. KEEP set says RAW may still hold what the agent produced before the
// failure, and it is parsed and kept beside the reason. Exits 0 on an answer
// the CLI did not flag, 1 on any failure.
import { readFileSync } from "node:fs";

const [runner = "", model = "", seconds = "", exitArg = "", reason = "", keep = ""] = process.argv.slice(2);

// why: one usage shape, the same keys in the same order, on every path a caller can hit.
const ZERO = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };

function tryParse(text) {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function num(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textOf(content) {
	if (!Array.isArray(content)) return "";
	return content
		.filter((part) => part?.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("");
}

// why: pi meters each turn separately, so a run that called tools reports its prompt once
// per turn. The comparable number is the sum, and the reply is the last assistant turn.
function addUsage(total, usage) {
	return {
		input: total.input + num(usage?.input),
		output: total.output + num(usage?.output),
		cacheRead: total.cacheRead + num(usage?.cacheRead),
		cacheWrite: total.cacheWrite + num(usage?.cacheWrite),
		cost: total.cost + num(usage?.cost?.total),
	};
}

// pi -p --mode json writes one event per line; every assistant turn ends in a
// message_end carrying that turn's text and usage.
function parsePi(raw) {
	let reply;
	let usage = ZERO;
	for (const line of raw.split("\n")) {
		const event = tryParse(line);
		if (event?.type !== "message_end" || event.message?.role !== "assistant") continue;
		reply = textOf(event.message.content);
		usage = addUsage(usage, event.message.usage);
	}
	return reply === undefined ? undefined : { reply, usage, failed: false };
}

// claude -p --output-format json writes one object: the reply in "result", the
// tokens in "usage" under Anthropic's names, the dollars in "total_cost_usd".
function parseClaude(raw) {
	const obj = tryParse(raw.trim());
	if (typeof obj?.result !== "string") return undefined;
	const u = obj.usage ?? {};
	return {
		reply: obj.result,
		usage: {
			input: num(u.input_tokens),
			output: num(u.output_tokens),
			cacheRead: num(u.cache_read_input_tokens),
			cacheWrite: num(u.cache_creation_input_tokens),
			cost: num(obj.total_cost_usd),
		},
		failed: obj.is_error === true,
	};
}

const rc = exitArg === "" ? null : Number(exitArg);

function answer() {
	const parse = runner === "pi" ? parsePi : parseClaude;
	const got = parse(readFileSync(0, "utf8"));
	if (!got) return { reply: `${runner}: no reply in its output`, usage: ZERO, code: 1 };
	return { reply: got.reply, usage: got.usage, code: got.failed || rc !== 0 ? 1 : 0 };
}

// why: a kill at budget used to throw away everything the agent had already produced, so
// an item it had finished but not closed reopened as a failure with usage zero. With KEEP
// the reply and the real usage survive; the reason still travels and exit still carries 124.
// Without KEEP stdin is never read, because a bad-args caller has a terminal on it.
function kept() {
	const got = (runner === "pi" ? parsePi : parseClaude)(readFileSync(0, "utf8"));
	return got
		? { reply: `${reason}; kept: ${got.reply}`, usage: got.usage, code: 1 }
		: { reply: reason, usage: ZERO, code: 1 };
}

const failure = () => (keep ? kept() : { reply: reason, usage: ZERO, code: 1 });
const { reply, usage, code } = reason ? failure() : answer();
const line = { runner, model, seconds: num(Number(seconds)), reply, usage, exit: rc };
process.stdout.write(`${JSON.stringify(line)}\n`);
process.exit(code);
