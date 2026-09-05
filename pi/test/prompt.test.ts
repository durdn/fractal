import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { makeFractalHandler, makeToolCallHook } from "../extension/index.ts";
import {
	buildProcessPrompt,
	fractalHome,
	injectSpec,
	packageHome,
	specBlocks,
} from "../extension/prompt.ts";
import { makeFakeCtx, makeFakePi } from "./fixtures/fake-pi.mjs";

const SPEC =
	"SPEC_SENTINEL_7f3a\ndata Axis = Meta | Goals\n  -- trailing spaces kept  \nEND_SPEC_7f3a";
const AXIS = "AXIS_SENTINEL_91cd\n1. pattern.\n\n2. work.\nEND_AXIS_91cd";
const HOME = "fractal-home";

// why: every path the reader is asked for is answered from this map, so no disk is touched.
function reader(): (path: string) => string {
	const byPath = new Map([
		[`${HOME}/spec.md`, SPEC],
		[`${HOME}/code-axis.md`, AXIS],
	]);
	return (path) => {
		const text = byPath.get(path);
		if (text === undefined) throw new Error(`unexpected read: ${path}`);
		return text;
	};
}

const built = () => buildProcessPrompt("build the thing", HOME, reader());

describe("buildProcessPrompt", () => {
	it("embeds spec.md and the axis file verbatim, whole", () => {
		const prompt = built();
		assert.ok(prompt.includes(SPEC), "spec text is not present verbatim");
		assert.ok(prompt.includes(AXIS), "axis text is not present verbatim");
	});

	it("reads exactly spec.md and code-axis.md under the given home", () => {
		const seen: string[] = [];
		buildProcessPrompt("i", HOME, (path) => {
			seen.push(path);
			return reader()(path);
		});
		assert.deepEqual(seen, [`${HOME}/spec.md`, `${HOME}/code-axis.md`]);
	});

	it("names the intent it was given", () => {
		assert.ok(
			buildProcessPrompt("port the loop to pi", HOME, reader()).includes("port the loop to pi"),
		);
	});

	it("is exactly three parts joined by blank lines: intent, spec blocks, the process line", () => {
		const expected = [
			"Intent: build the thing",
			specBlocks(HOME, reader()),
			"You are the process: plan by default, delegate independent work, judge the evidence. Add a planning child only for uncertain decomposition or a requested challenge. User scope governs.",
		].join("\n\n");
		assert.equal(built(), expected);
	});

	it("leaks no box path when home and sources carry none", () => {
		const prompt = built();
		assert.ok(!prompt.includes(String.raw`C:\Users`), "prompt leaks a Windows box path");
		assert.ok(!prompt.includes("/c/Users"), "prompt leaks a Git Bash box path");
		assert.ok(!/[A-Za-z]:\\/.test(prompt), "prompt leaks a Windows drive path");
	});
});

describe("fractalHome", () => {
	it("throws and names the variable when FRACTAL_HOME is unset", () => {
		assert.throws(() => fractalHome({}, "/nonexistent/fractal-home"), /FRACTAL_HOME/);
	});

	it("throws when FRACTAL_HOME is empty", () => {
		assert.throws(
			() => fractalHome({ FRACTAL_HOME: "" }, "/nonexistent/fractal-home"),
			/FRACTAL_HOME/,
		);
	});

	it("returns the value when set", () => {
		assert.equal(fractalHome({ FRACTAL_HOME: "fractal-home" }), "fractal-home");
	});
});

describe("makeFractalHandler", () => {
	it("sends the built lead prompt as a user turn, reading the real files", async () => {
		// why: the handler injects its own readFileSync, so the home must exist on disk.
		const dir = mkdtempSync(join(tmpdir(), "fractal-home-"));
		writeFileSync(join(dir, "spec.md"), SPEC);
		writeFileSync(join(dir, "code-axis.md"), AXIS);
		const pi = makeFakePi();
		const ctx = makeFakeCtx();
		try {
			// why: init is the handler's own step and has its own tests; here it stands aside
			// so this one keeps testing the prompt.
			await makeFractalHandler(
				pi as never,
				() => dir,
				() => "ok",
			)("  build the thing  ", ctx as never);
			assert.equal(pi.userMessages.length, 1);
			assert.ok(pi.userMessages[0].includes("Intent: build the thing"));
			assert.ok(pi.userMessages[0].includes(SPEC));
			assert.ok(pi.userMessages[0].includes(AXIS));
			assert.equal(pi.spawns.length, 0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("refuses an empty intent and sends no turn", async () => {
		const pi = makeFakePi();
		const ctx = makeFakeCtx();
		await makeFractalHandler(pi as never, () => HOME)("   ", ctx as never);
		assert.equal(pi.userMessages.length, 0);
		assert.equal(ctx.notices[0].level, "warning");
	});

	it("surfaces the home error and sends no turn", async () => {
		const pi = makeFakePi();
		const ctx = makeFakeCtx();
		const boom = () => {
			throw new Error("FRACTAL_HOME is not set.");
		};
		await makeFractalHandler(pi as never, boom)("go", ctx as never);
		assert.equal(pi.userMessages.length, 0);
		assert.equal(ctx.notices[0].level, "error");
		assert.match(ctx.notices[0].msg, /FRACTAL_HOME/);
	});
});

describe("injectSpec", () => {
	it("prepends both files verbatim to a lead or senior task", () => {
		const call = { agent: "fractal-lead", task: "do the thing" };
		assert.equal(injectSpec(call, HOME, reader()), true);
		assert.ok(call.task.includes(SPEC), "the task does not carry spec.md verbatim");
		assert.ok(call.task.includes(AXIS), "the task does not carry code-axis.md verbatim");
		assert.ok(call.task.endsWith("do the thing"), "the lead's own task text was lost");
	});

	it("a scout, worker or verifier takes the axis, not spec.md", () => {
		for (const agent of ["fractal-scout", "fractal-worker", "fractal-verifier"]) {
			const call = { agent, task: "do the thing" };
			assert.equal(injectSpec(call, HOME, reader()), true);
			assert.ok(call.task.includes(AXIS), `${agent}: the task does not carry the axis verbatim`);
			assert.ok(!call.task.includes(SPEC), `${agent}: the task carries spec.md, the full read`);
			assert.ok(call.task.endsWith("do the thing"), `${agent}: the lead's own task text was lost`);
		}
	});

	it("leaves an agent that is not a fractal role alone", () => {
		const call = { agent: "general", task: "do the thing" };
		assert.equal(injectSpec(call, HOME, reader()), false);
		assert.equal(call.task, "do the thing");
	});

	it("does not prepend a second time", () => {
		const call = { agent: "fractal-lead", task: "go" };
		injectSpec(call, HOME, reader());
		const once = call.task;
		assert.equal(injectSpec(call, HOME, reader()), false);
		assert.equal(call.task, once);
	});

	it("ignores a call with no task", () => {
		assert.equal(injectSpec({ agent: "fractal-worker" }, HOME, reader()), false);
	});
});

describe("the tool_call hook", () => {
	function withHome(body: (dir: string) => Promise<void>): Promise<void> {
		const dir = mkdtempSync(join(tmpdir(), "fractal-home-"));
		writeFileSync(join(dir, "spec.md"), SPEC);
		writeFileSync(join(dir, "code-axis.md"), AXIS);
		return body(dir).finally(() => rmSync(dir, { recursive: true, force: true }));
	}

	it("puts the files into the task the subagent tool actually receives", async () => {
		await withHome(async (dir) => {
			const pi = makeFakePi();
			const hook = makeToolCallHook(() => dir);
			pi.on("tool_call", hook);
			await pi.callTool("subagent", { agent: "fractal-lead", task: "plan the loop" });
			await pi.callTool("subagent", { agent: "fractal-worker", task: "write the file" });
			assert.equal(pi.spawns.length, 2);
			assert.ok(pi.spawns[0].task.includes(SPEC), "the lead task does not carry spec.md");
			assert.ok(pi.spawns[0].task.includes(AXIS), "the lead task does not carry the axis");
			assert.ok(
				!pi.spawns[1].task.includes(SPEC),
				"the worker task carries spec.md, the full read",
			);
			assert.ok(pi.spawns[1].task.includes(AXIS), "the worker task does not carry the axis");
		});
	});

	it("touches no other tool", async () => {
		await withHome(async (dir) => {
			const pi = makeFakePi();
			pi.on(
				"tool_call",
				makeToolCallHook(() => dir),
			);
			await pi.callTool("subagent", { agent: "some-other-agent", task: "plain" });
			assert.equal(pi.spawns[0].task, "plain");
		});
	});

	it("still spawns when the home cannot be read, rather than blocking the tool", async () => {
		const pi = makeFakePi();
		pi.on(
			"tool_call",
			makeToolCallHook(() => {
				throw new Error("FRACTAL_HOME is not set.");
			}),
		);
		await pi.callTool("subagent", { agent: "fractal-worker", task: "still spawns" });
		assert.equal(pi.spawns[0].task, "still spawns");
	});
});

describe("fractalHome fallback", () => {
	it("falls back to a directory holding spec.md when the env is unset", () => {
		const home = mkdtempSync(join(tmpdir(), "fractal-home-"));
		writeFileSync(join(home, "spec.md"), "# spec\n");
		assert.equal(fractalHome({}, home), home);
	});
	it("the env wins over the fallback", () => {
		assert.equal(fractalHome({ FRACTAL_HOME: "/x" }, "/y"), "/x");
	});
	it("packageHome is the checkout, whatever its directory is named", () => {
		assert.ok(existsSync(join(packageHome(), "spec.md")));
	});
});
