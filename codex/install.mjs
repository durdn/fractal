import {
	lstatSync,
	mkdirSync,
	readlinkSync,
	realpathSync,
	symlinkSync,
	unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const source = dirname(fileURLToPath(import.meta.url));
export const destination = () =>
	join(homedir(), ".agents", "skills", "fractal");

// Link the live checkout like Claude Code; never replace a user's file or directory.
export function deploy({ dest = destination(), uninstall = false } = {}) {
	dest = resolve(dest);
	let entry;
	try {
		entry = lstatSync(dest);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	if (entry) {
		if (
			!entry.isSymbolicLink() ||
			resolve(dirname(dest), readlinkSync(dest)) !== realpathSync(source)
		) {
			throw new Error(`codex: refusing to replace unrelated path ${dest}`);
		}
		if (!uninstall) return `codex: ready (${dest})`;
		unlinkSync(dest); // Unlink only; never traverse the skill or its checkout.
		return `codex: removed ${dest} (checkout retained)`;
	}
	if (uninstall) return `codex: absent (${dest})`;
	mkdirSync(dirname(dest), { recursive: true });
	symlinkSync(
		realpathSync(source),
		dest,
		process.platform === "win32" ? "junction" : "dir",
	);
	return `codex: installed (${dest})`;
}
