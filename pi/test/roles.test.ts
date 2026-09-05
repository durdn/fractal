import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { makeFractalInstallHandler, syncOnActivate } from "../extension/index.ts";
import { agentDir, compose, rolesDir, syncAgents } from "../extension/roles.ts";
import { makeFakeCtx } from "./fixtures/fake-pi.mjs";

// why: the bodies are shared with the other harnesses, so they live in the fractal home,
// two levels up from this file, not inside this package.
const SRC = join(fileURLToPath(new URL("../../", import.meta.url)), "roles");
const ROLES = [
	"fractal-lead.md",
	"fractal-scout.md",
	"fractal-senior.md",
	"fractal-verifier.md",
	"fractal-worker.md",
];

// why: env is passed in, never assigned onto process.env, so the real box is untouched.
function withHome(body: (home: string, dst: string, env: NodeJS.ProcessEnv) => void): void {
	const dir = mkdtempSync(join(tmpdir(), "fractal-roles-"));
	const home = join(dir, "home");
	const dst = join(dir, "pi");
	mkdirSync(join(home, "roles"), { recursive: true });
	for (const name of ROLES) {
		writeFileSync(join(home, "roles", name), `body of ${name}\n`);
	}
	try {
		body(home, dst, { FRACTAL_HOME: home, PI_CODING_AGENT_DIR: dst });
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function frontmatter(text: string): Map<string, string> {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
	assert.ok(match, "no frontmatter block");
	const keys = new Map<string, string>();
	for (const line of match[1].split(/\r?\n/)) {
		const kv = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line);
		if (kv) keys.set(kv[1], kv[2].trim());
	}
	return keys;
}

describe("agentDir", () => {
	it("honours PI_CODING_AGENT_DIR", () => {
		assert.equal(
			agentDir({ PI_CODING_AGENT_DIR: join("base", "pi") }),
			join("base", "pi", "agents"),
		);
	});

	it("falls back to the home directory when unset", () => {
		assert.equal(agentDir({}), join(homedir(), ".pi", "agent", "agents"));
	});
});

describe("rolesDir", () => {
	it("is the roles folder under FRACTAL_HOME", () => {
		assert.equal(rolesDir({ FRACTAL_HOME: "fractal-home" }), join("fractal-home", "roles"));
	});

	it("throws and names the variable when FRACTAL_HOME is unset and nothing sits beside the package", () => {
		const missing = "/nonexistent/fractal-home";
		assert.throws(() => rolesDir({}, missing), /FRACTAL_HOME/);
		assert.throws(() => rolesDir({ FRACTAL_HOME: "" }, missing), /FRACTAL_HOME/);
	});

	it("falls back to the package's own home when the env is unset", () => {
		assert.equal(rolesDir({}), SRC);
	});
});

describe("compose", () => {
	it("keeps the shared body verbatim under a pi frontmatter block", () => {
		const out = compose("fractal-worker", "line one\n\nline two\n");
		assert.ok(out.endsWith("line one\n\nline two\n"), "the body was not kept verbatim");
		assert.equal(frontmatter(out).get("name"), "fractal-worker");
		assert.equal(frontmatter(out).get("auto-exit"), "true");
	});

	it("names each role after its own file", () => {
		for (const file of ROLES) {
			const role = file.replace(/\.md$/, "");
			assert.equal(frontmatter(compose(role, "b")).get("name"), role);
		}
	});

	it("gives no role a spawning allowlist: pattern spawns nothing", () => {
		// why: a lead with subagent_agents ran the loop itself and judged (03/09/2026).
		for (const file of ROLES) {
			const role = file.replace(/\.md$/, "");
			assert.equal(frontmatter(compose(role, "b")).get("subagent_agents"), undefined, role);
		}
	});

	it("refuses a body it has no frontmatter row for", () => {
		assert.throws(() => compose("fractal-inventor", "b"), /fractal-inventor/);
	});
});

describe("syncAgents", () => {
	it("writes one composed file per shared body and returns their names", () => {
		withHome((home, dst, env) => {
			const written = syncAgents(env);
			assert.deepEqual(written.slice().sort(), ROLES);
			const out = join(dst, "agents");
			assert.deepEqual(readdirSync(out).sort(), ROLES);
			for (const name of ROLES) {
				const body = readFileSync(join(home, "roles", name), "utf8");
				assert.equal(readFileSync(join(out, name), "utf8"), compose(name.slice(0, -3), body));
			}
		});
	});

	it("is idempotent: the second run writes nothing", () => {
		withHome((_home, _dst, env) => {
			syncAgents(env);
			assert.deepEqual(syncAgents(env), []);
		});
	});

	it("rewrites only a target whose text differs", () => {
		withHome((home, dst, env) => {
			syncAgents(env);
			const stale = join(dst, "agents", "fractal-worker.md");
			writeFileSync(stale, "stale");
			assert.deepEqual(syncAgents(env), ["fractal-worker.md"]);
			const body = readFileSync(join(home, "roles", "fractal-worker.md"), "utf8");
			assert.equal(readFileSync(stale, "utf8"), compose("fractal-worker", body));
		});
	});

	it("returns nothing when the home has no roles directory", () => {
		withHome((_home, dst, env) => {
			assert.deepEqual(syncAgents({ ...env, FRACTAL_HOME: join(dst, "absent") }), []);
		});
	});

	it("syncs the package's own roles when the env is unset", () => {
		const dir = mkdtempSync(join(tmpdir(), "fractal-roles-fallback-"));
		try {
			const written = syncAgents({ PI_CODING_AGENT_DIR: dir });
			assert.deepEqual(written.sort(), ROLES);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("the shipped role bodies", () => {
	it("are exactly the five the loop spawns", () => {
		assert.deepEqual(readdirSync(SRC).sort(), ROLES);
	});

	it("carry no frontmatter of their own; the harness adds it", () => {
		for (const file of ROLES) {
			assert.ok(!readFileSync(join(SRC, file), "utf8").startsWith("---"), file);
		}
	});

	it("speak of no replay; a failure is the next intent", () => {
		for (const file of ROLES) {
			const body = readFileSync(join(SRC, file), "utf8");
			assert.ok(!/replay/i.test(body), `${file} still speaks of a replay`);
		}
	});

	it("each compose into a role pi can install", () => {
		// why: who reads what is the spec's rule; a lead or senior reads both files whole,
		// a step role takes the axis lines that bind its step.
		const fullRead = new Set(["fractal-lead", "fractal-senior"]);
		for (const file of ROLES) {
			const role = file.replace(/\.md$/, "");
			const out = compose(role, readFileSync(join(SRC, file), "utf8"));
			assert.equal(frontmatter(out).get("name"), role);
			assert.ok(/verbatim/.test(out), `${file} drops the verbatim rule`);
			if (fullRead.has(role)) {
				assert.ok(/in full and\s+verbatim/.test(out), `${file} drops the full read`);
			} else {
				assert.ok(/lines that bind your\s+step/.test(out), `${file} drops the step-lines read`);
			}
		}
	});
});

describe("syncOnActivate", () => {
	it("returns what was written and reports nothing when the sync works", () => {
		const said: string[] = [];
		const written = syncOnActivate(
			(m) => said.push(m),
			() => ["fractal-worker.md"],
		);
		assert.deepEqual(written, ["fractal-worker.md"]);
		assert.deepEqual(said, []);
	});

	it("reports a sync failure instead of swallowing it", () => {
		const said: string[] = [];
		const written = syncOnActivate(
			(m) => said.push(m),
			() => {
				throw new Error("EACCES: permission denied");
			},
		);
		assert.deepEqual(written, []);
		assert.equal(said.length, 1);
		assert.match(said[0], /EACCES/);
		assert.match(said[0], /fractal-install/);
	});
});

describe("the fractal-install command", () => {
	// why: the handler is async, so the temp home outlives it here rather than being torn
	// down by withHome's synchronous finally.
	async function inHome(body: (dst: string, env: NodeJS.ProcessEnv) => Promise<void>) {
		const dir = mkdtempSync(join(tmpdir(), "fractal-install-"));
		const home = join(dir, "home");
		const dst = join(dir, "pi");
		mkdirSync(join(home, "roles"), { recursive: true });
		for (const name of ROLES) writeFileSync(join(home, "roles", name), `body of ${name}\n`);
		try {
			await body(dst, { FRACTAL_HOME: home, PI_CODING_AGENT_DIR: dst });
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}

	it("reports what it wrote, then that there was nothing left to write", async () => {
		await inHome(async (dst, env) => {
			const ctx = makeFakeCtx();
			const handler = makeFractalInstallHandler(env);
			await handler("", ctx as never);
			await handler("", ctx as never);
			assert.equal(ctx.notices[0].level, "info");
			assert.match(ctx.notices[0].msg, /wrote fractal-lead\.md/);
			assert.match(ctx.notices[1].msg, /already up to date/);
			assert.ok(ctx.notices[1].msg.includes(join(dst, "agents")));
		});
	});

	it("with the env unset it installs from the package's own home, no crash", async () => {
		const dir = mkdtempSync(join(tmpdir(), "fractal-install-fallback-"));
		try {
			const ctx = makeFakeCtx();
			await makeFractalInstallHandler({ PI_CODING_AGENT_DIR: dir })("", ctx as never);
			assert.equal(ctx.notices[0].level, "info");
			assert.match(ctx.notices[0].msg, /wrote fractal-lead\.md/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
