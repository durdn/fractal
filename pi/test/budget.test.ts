import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { armWake, nextDeadline, overBudget } from "../extension/budget.ts";
import type { Item } from "../extension/types.ts";

const NOW = Date.parse("2026-08-28T12:00:00.000Z");
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();

function item(o: Partial<Item> & { id: string }): Item {
	return {
		title: "t",
		status: "in_progress",
		priority: 2,
		issue_type: "task",
		comment_count: 0,
		...o,
	};
}
const budgeted = (id: string, budget: string, startedMin: number, status = "in_progress") =>
	item({ id, status, started_at: ago(startedMin), metadata: { budget_min: budget } });

describe("overBudget", () => {
	test("flags an item past its budget and spares one inside it", () => {
		const out = overBudget([budgeted("late", "10", 30), budgeted("fine", "60", 30)], NOW);
		assert.deepEqual(
			out.map((b) => b.id),
			["late"],
		);
		assert.equal(out[0].budgetMin, 10);
		assert.equal(Math.round(out[0].elapsedMin), 30);
	});

	test("budget_min arriving as a string is parsed", () => {
		assert.equal(overBudget([budgeted("a", "5", 6)], NOW).length, 1);
		assert.equal(overBudget([budgeted("a", "5", 4)], NOW).length, 0);
	});

	test("a non-numeric, zero or negative budget_min is ignored, not thrown", () => {
		for (const bad of ["soon", "", "-5", "0", "NaN"]) {
			assert.deepEqual(overBudget([budgeted("a", bad, 999)], NOW), [], `budget_min=${bad}`);
		}
	});

	test("missing started_at, bad started_at, no metadata or not in_progress are ignored", () => {
		const items: Item[] = [
			item({ id: "nostart", metadata: { budget_min: "1" } }),
			item({ id: "badstart", started_at: "not a date", metadata: { budget_min: "1" } }),
			item({ id: "nometa", started_at: ago(999) }),
			budgeted("open", "1", 999, "open"),
			budgeted("closed", "1", 999, "closed"),
		];
		assert.deepEqual(overBudget(items, NOW), []);
	});
});

describe("nextDeadline", () => {
	test("returns the nearest remaining ms", () => {
		const ms = nextDeadline([budgeted("a", "60", 30), budgeted("b", "60", 50)], NOW);
		assert.equal(ms, 10 * 60000);
	});

	test("returns 0, never a negative number, for a deadline already passed", () => {
		const ms = nextDeadline([budgeted("a", "10", 30)], NOW);
		assert.equal(ms, 0);
	});

	test("returns undefined when nothing is budgeted", () => {
		assert.equal(nextDeadline([], NOW), undefined);
		assert.equal(nextDeadline([item({ id: "a", started_at: ago(5) })], NOW), undefined);
	});
});

describe("armWake", () => {
	test("the returned cancel prevents the fire callback", async () => {
		let fired = 0;
		const cancel = armWake(5, () => {
			fired += 1;
		});
		cancel();
		await new Promise((r) => setTimeout(r, 30));
		assert.equal(fired, 0);
	});

	test("without cancel the callback fires", async () => {
		let fired = 0;
		armWake(5, () => {
			fired += 1;
		});
		await new Promise((r) => setTimeout(r, 30));
		assert.equal(fired, 1);
	});
});

describe("the budget field", () => {
	test("estimated_minutes, set by bd --estimate, is the budget", () => {
		const late = item({ id: "late", started_at: ago(30), estimated_minutes: 10 });
		const fine = item({ id: "fine", started_at: ago(30), estimated_minutes: 60 });
		assert.deepEqual(
			overBudget([late, fine], NOW).map((b) => b.id),
			["late"],
		);
	});

	test("estimated_minutes wins over the budget_min metadata older loops improvised", () => {
		const early = item({
			id: "a",
			started_at: ago(30),
			estimated_minutes: 60,
			metadata: { budget_min: "10" },
		});
		assert.deepEqual(overBudget([early], NOW), []);
	});
});
