import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeFulltextSearch } from "../dist/tools/codesearch.js";
import { registerAllTools } from "../dist/mcp/tools.js";

const roots = [];
const originalCwd = process.cwd();

function makeRoot() {
	const root = join(tmpdir(), `pi-ide-search-test-${process.pid}-${Date.now()}-${roots.length}`);
	mkdirSync(root, { recursive: true });
	roots.push(root);
	return root;
}

afterEach(() => {
	process.chdir(originalCwd);
	for (const root of roots.splice(0)) {
		if (existsSync(root)) {
			rmSync(root, { recursive: true, force: true });
		}
	}
});

describe("full-text search", () => {
	it("skips configured noisy directories", () => {
		const root = makeRoot();
		mkdirSync(join(root, "src"), { recursive: true });
		mkdirSync(join(root, ".tmp"), { recursive: true });
		mkdirSync(join(root, "_agents"), { recursive: true });
		writeFileSync(join(root, "src", "index.ts"), "export const NeedleSymbol = 1;\n");
		writeFileSync(join(root, ".tmp", "ignored.ts"), "export const NeedleSymbol = 2;\n");
		writeFileSync(join(root, "_agents", "ignored.ts"), "export const NeedleSymbol = 3;\n");
		process.chdir(root);

		const results = executeFulltextSearch("NeedleSymbol", 10);

		expect(results.map((result) => result.file)).toEqual(["src/index.ts"]);
	});
});

describe("MCP tools", () => {
	it("does not resolve the graph during registration or code full-text search", async () => {
		const root = makeRoot();
		mkdirSync(join(root, "src"), { recursive: true });
		writeFileSync(join(root, "src", "index.ts"), "export const NeedleSymbol = 1;\n");
		process.chdir(root);

		const tools = new Map();
		const server = {
			registerTool(name, _config, handler) {
				tools.set(name, handler);
			},
		};
		let graphReads = 0;
		registerAllTools(server, () => {
			graphReads += 1;
			throw new Error("graph should not be read for full-text search");
		}, root);

		expect(graphReads).toBe(0);
		const result = await tools.get("code_search")({ query: "NeedleSymbol", target: "code" });

		expect(graphReads).toBe(0);
		expect(result.content[0].text).toContain("src/index.ts");
	});
});
