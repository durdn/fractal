import type { Item } from "./types.ts";

// why: herdr enforces no timeout of any kind, so this file is the only guard against
// a spawned child running unbounded; the lead polls these functions to cut it off.

// why: the tracker round trips a budget as a number, but a caller may set it as a string.
function parseMinutes(raw: unknown): number | undefined {
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

// why: the budget is the tracker's own estimated_minutes field; metadata budget_min is
// what the loops improvised before the conventions landed, kept as a fallback so an
// item created by an older lead still shows up as over budget.
function budgetOf(item: Item): number | undefined {
	return parseMinutes(item.estimated_minutes) ?? parseMinutes(item.metadata?.budget_min);
}

type Budgeted = { id: string; budgetMin: number; elapsedMin: number };

function budgeted(items: Item[], now: number): Budgeted[] {
	const out: Budgeted[] = [];
	for (const item of items) {
		if (item.status !== "in_progress") continue;
		const budgetMin = budgetOf(item);
		if (budgetMin === undefined || !item.started_at) continue;
		const startedMs = Date.parse(item.started_at);
		if (!Number.isFinite(startedMs)) continue;
		const elapsedMin = (now - startedMs) / 60000;
		out.push({ id: item.id, budgetMin, elapsedMin });
	}
	return out;
}

export function overBudget(items: Item[], now: number): Budgeted[] {
	return budgeted(items, now).filter((b) => b.elapsedMin > b.budgetMin);
}

export function nextDeadline(items: Item[], now: number): number | undefined {
	let nearest: number | undefined;
	for (const b of budgeted(items, now)) {
		// why: a deadline already passed wakes the lead now, not in the past.
		const untilMs = Math.max(0, (b.budgetMin - b.elapsedMin) * 60000);
		if (nearest === undefined || untilMs < nearest) nearest = untilMs;
	}
	return nearest;
}

export function armWake(msUntil: number, fire: () => void): () => void {
	const timer = setTimeout(fire, msUntil);
	// why: an armed wake must not hold the process open on its own.
	timer.unref();
	return () => clearTimeout(timer);
}
