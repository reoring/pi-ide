import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGraphCache } from "../dist/core/cache.js";
import { resetCache, scanProject } from "../dist/core/scanner.js";

const roots = [];

function makeRoot() {
	const root = join(tmpdir(), `pi-ide-test-${process.pid}-${Date.now()}-${roots.length}`);
	mkdirSync(root, { recursive: true });
	roots.push(root);
	return root;
}

afterEach(() => {
	resetCache();
	for (const root of roots.splice(0)) {
		if (existsSync(root)) {
			rmSync(root, { recursive: true, force: true });
		}
	}
});

describe("scanner", () => {
	it("skips non-source json, .tmp, and _agents trees", () => {
		const root = makeRoot();
		mkdirSync(join(root, "src"), { recursive: true });
		mkdirSync(join(root, ".tmp"), { recursive: true });
		mkdirSync(join(root, "_agents", "mailbox"), { recursive: true });
		writeFileSync(join(root, "src", "index.ts"), "export function alpha() { return 1; }\n");
		writeFileSync(join(root, "package.json"), '{"scripts":{"test":"vitest"}}\n');
		writeFileSync(join(root, "config.json"), '{"alpha":true}\n');
		writeFileSync(join(root, ".tmp", "ignored.ts"), "export function ignored() {}\n");
		writeFileSync(join(root, "_agents", "mailbox", "note.json"), '{"ignored":true}\n');

		const graph = scanProject(root);
		const graphFiles = new Set([
			...graph.fileSymbols.keys(),
			...graph.fileImports.keys(),
			...graph.fileCalls.keys(),
			...graph.fileImportBindings.keys(),
		]);

		expect(graphFiles.has("src/index.ts")).toBe(true);
		expect([...graphFiles].some((file) => file.endsWith(".json"))).toBe(false);
		expect([...graphFiles].some((file) => file.startsWith(".tmp/"))).toBe(false);
		expect([...graphFiles].some((file) => file.startsWith("_agents/"))).toBe(false);
	});

	it("rejects old graph cache versions", () => {
		const root = makeRoot();
		const cachePath = join(root, "graph-cache.json");
		writeFileSync(
			cachePath,
			JSON.stringify({
				version: 2,
				timestamp: Date.now(),
				symbols: [],
				edges: [],
				fileMtimes: {},
				fileSymbols: {},
				fileImports: {},
				fileCalls: {},
				fileImportBindings: {},
				fileExports: {},
			}),
		);

		expect(loadGraphCache(cachePath)).toBeNull();
	});
});
