import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const LIMITS = { complexity: 10, funcLines: 40, params: 4, fileLines: 120 };
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionDir = join(root, "extension");

const FUNCTION_KINDS = new Set([
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.MethodDeclaration,
	ts.SyntaxKind.ArrowFunction,
	ts.SyntaxKind.FunctionExpression,
	ts.SyntaxKind.Constructor,
	ts.SyntaxKind.GetAccessor,
	ts.SyntaxKind.SetAccessor,
]);
const DECISION_KINDS = new Set([
	ts.SyntaxKind.IfStatement,
	ts.SyntaxKind.ForStatement,
	ts.SyntaxKind.ForInStatement,
	ts.SyntaxKind.ForOfStatement,
	ts.SyntaxKind.WhileStatement,
	ts.SyntaxKind.DoStatement,
	ts.SyntaxKind.CaseClause,
	ts.SyntaxKind.CatchClause,
	ts.SyntaxKind.ConditionalExpression,
]);
const LOGICAL_OPS = new Set([
	ts.SyntaxKind.AmpersandAmpersandToken,
	ts.SyntaxKind.BarBarToken,
	ts.SyntaxKind.QuestionQuestionToken,
]);

function findTsFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...findTsFiles(full));
		else if (entry.name.endsWith(".ts")) out.push(full);
	}
	return out;
}

function isDecisionPoint(node) {
	if (node.kind === ts.SyntaxKind.BinaryExpression) return LOGICAL_OPS.has(node.operatorToken.kind);
	return DECISION_KINDS.has(node.kind);
}

function nameFromParent(node) {
	const parent = node.parent;
	if (!parent) return undefined;
	const holder =
		ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) ? parent : undefined;
	return holder && ts.isIdentifier(holder.name) ? holder.name.text : undefined;
}

function functionName(node) {
	if (node.name && ts.isIdentifier(node.name)) return node.name.text;
	if (node.kind === ts.SyntaxKind.Constructor) return "constructor";
	return nameFromParent(node) ?? "<anonymous>";
}

function startContext(node, sourceFile) {
	return {
		name: functionName(node),
		startLine: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
		endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
		params: node.parameters ? node.parameters.length : 0,
		complexity: 1,
	};
}

// why: one shared stack, mutated across the recursive walk, so decision points
// inside a nested function accrue to that function alone, not its enclosing one.
function walk(node, sourceFile, stack, results) {
	const isFn = FUNCTION_KINDS.has(node.kind);
	if (isFn) stack.push(startContext(node, sourceFile));
	else if (stack.length > 0 && isDecisionPoint(node)) stack[stack.length - 1].complexity += 1;
	ts.forEachChild(node, (child) => walk(child, sourceFile, stack, results));
	if (isFn) results.push(stack.pop());
}

function analyzeFile(filePath) {
	const source = readFileSync(filePath, "utf8");
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
	const results = [];
	walk(sourceFile, sourceFile, [], results);
	return { results, lineCount: source.split("\n").length };
}

function functionRow(ctx, filePath) {
	const lines = ctx.endLine - ctx.startLine + 1;
	const fails = [];
	if (ctx.complexity > LIMITS.complexity) fails.push("complexity");
	if (lines > LIMITS.funcLines) fails.push("lines");
	if (ctx.params > LIMITS.params) fails.push("params");
	return {
		file: relative(root, filePath).replace(/\\/g, "/"),
		name: ctx.name,
		lines,
		params: ctx.params,
		complexity: ctx.complexity,
		fails,
	};
}

function severity(row) {
	return row.fails.length * 1000 + row.complexity + row.lines / 100;
}

function printTable(rows) {
	console.log(["file", "function", "lines", "params", "cx", "status"].join("\t"));
	for (const row of rows) {
		const status = row.fails.length ? `FAIL(${row.fails.join(",")})` : "ok";
		console.log([row.file, row.name, row.lines, row.params, row.complexity, status].join("\t"));
	}
}

function summaryLine(fileCount, rows, fileFails) {
	const funcFails = rows.filter((r) => r.fails.length > 0).length;
	const bits = `${fileCount} files, ${rows.length} functions, ${funcFails} function failures, ${fileFails.length} file-length failures`;
	const detail = fileFails.length ? ` - ${fileFails.join("; ")}` : "";
	return `SUMMARY: ${bits}${detail}`;
}

function main() {
	const files = findTsFiles(extensionDir);
	const rows = [];
	const fileFails = [];
	for (const file of files) {
		const { results, lineCount } = analyzeFile(file);
		for (const ctx of results) rows.push(functionRow(ctx, file));
		if (lineCount > LIMITS.fileLines) {
			fileFails.push(`${relative(root, file).replace(/\\/g, "/")} (${lineCount} lines)`);
		}
	}
	rows.sort((a, b) => severity(a) - severity(b));
	printTable(rows);
	console.log(summaryLine(files.length, rows, fileFails));
	const failed = rows.some((r) => r.fails.length > 0) || fileFails.length > 0;
	process.exit(failed ? 1 : 0);
}

main();
