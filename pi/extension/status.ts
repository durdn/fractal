import type { Item } from "./types.ts";

type Tree = {
	groups: Map<string | undefined, Item[]>;
	visited: Set<string>;
	out: string[];
};

function groupByParent(items: Item[]): Map<string | undefined, Item[]> {
	const groups = new Map<string | undefined, Item[]>();
	for (const item of items) {
		const bucket = groups.get(item.parent);
		if (bucket) bucket.push(item);
		else groups.set(item.parent, [item]);
	}
	return groups;
}

// why: the step is a label, `step:work`, not a field and not the title; the tree reads it
// there and so does every other reader, so all see the same step or none does.
export function stepOf(item: Item): string | undefined {
	return item.labels?.find((l) => l.startsWith("step:"))?.slice("step:".length) || undefined;
}

function renderNode(item: Item, depth: number, t: Tree): void {
	if (t.visited.has(item.id)) return;
	t.visited.add(item.id);
	const step = stepOf(item);
	const budget = item.estimated_minutes ? ` ${item.estimated_minutes}m` : "";
	const tags = `[${[item.status, step].filter(Boolean).join(" ")}${budget}]`;
	t.out.push(`${"  ".repeat(depth)}${item.id} ${tags} ${item.title}`);
	for (const child of t.groups.get(item.id) ?? []) renderNode(child, depth + 1, t);
}

// why: renderTree must never throw; it is the only view of a running fractal. Walking
// every item and skipping the visited ones renders an orphan or a parent cycle at the
// root, degraded, instead of hiding the work or looping forever.
export function renderTree(items: Item[], root?: string): string {
	if (items.length === 0) return "(no items)";
	const t: Tree = { groups: groupByParent(items), visited: new Set(), out: [] };
	if (root) {
		const start = items.find((i) => i.id === root);
		if (!start) return `(root ${root} not found)`;
		renderNode(start, 0, t);
	} else {
		for (const item of items) renderNode(item, 0, t);
	}
	return t.out.join("\n");
}
