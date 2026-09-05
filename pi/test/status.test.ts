import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderTree, stepOf } from "../extension/status.ts";
import type { Item } from "../extension/types.ts";

function item(id: string, parent?: string, status = "open"): Item {
	return {
		id,
		title: `title ${id}`,
		status,
		priority: 2,
		issue_type: "task",
		parent,
		comment_count: 0,
	};
}

describe("renderTree", () => {
	test("renders a parent and two children as an indented tree", () => {
		const out = renderTree([item("p"), item("c1", "p"), item("c2", "p")]);
		const lines = out.split("\n");
		assert.equal(lines.length, 3);
		for (const id of ["p", "c1", "c2"]) assert.ok(out.includes(id), `missing ${id}`);
		assert.ok(lines[0].startsWith("p "), lines[0]);
		assert.ok(lines[1].startsWith("  c1 "), lines[1]);
		assert.ok(lines[2].startsWith("  c2 "), lines[2]);
		assert.ok(out.includes("[open]"));
	});

	test("keeps an orphan whose parent is not in the list", () => {
		const out = renderTree([item("p"), item("c1", "p"), item("orphan", "gone")]);
		assert.ok(out.includes("orphan"), out);
		assert.equal(out.split("\n").length, 3);
	});

	test("a parent cycle terminates and lists both items", { timeout: 2000 }, () => {
		const out = renderTree([item("a", "b"), item("b", "a")]);
		assert.ok(out.includes("a"), out);
		assert.ok(out.includes("b"), out);
		assert.equal(out.split("\n").length, 2);
	});

	test("a self parent terminates", { timeout: 2000 }, () => {
		assert.equal(renderTree([item("a", "a")]).split("\n").length, 1);
	});

	test("an empty list returns a short non-empty string", () => {
		const out = renderTree([]);
		assert.ok(out.length > 0);
		assert.ok(out.length < 40, out);
	});

	test("root selects a subtree, and a missing root says so", () => {
		const items = [item("p"), item("c1", "p"), item("other")];
		const out = renderTree(items, "p");
		assert.ok(out.includes("c1"));
		assert.ok(!out.includes("other"), out);
		assert.match(renderTree(items, "nope"), /not found/);
	});
});

describe("the step label", () => {
	test("stepOf reads step: and ignores every other label", () => {
		assert.equal(stepOf({ ...item("a"), labels: ["axis:Code", "step:verify"] }), "verify");
		assert.equal(stepOf({ ...item("a"), labels: ["axis:Code", "grade:opus.high"] }), undefined);
		assert.equal(stepOf(item("a")), undefined);
	});

	test("the tree shows the step and the estimate beside the status", () => {
		const child = { ...item("c1", "p"), labels: ["step:work", "by:w1"], estimated_minutes: 30 };
		const out = renderTree([item("p"), child]);
		assert.ok(out.includes("[open work 30m]"), out);
		assert.ok(out.includes("p [open] title p"), out);
	});
});
