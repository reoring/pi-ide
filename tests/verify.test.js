import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeVerifyJsonAsync, executeVerifyTextAsync } from "../dist/tools/verify.js";

const roots = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		if (existsSync(root)) {
			rmSync(root, { recursive: true, force: true });
		}
	}
});

describe("verify quick mode", () => {
	it("skips graph analysis", async () => {
		const root = mkdtempSync(join(tmpdir(), "pi-ide-verify-test-"));
		roots.push(root);

		const text = await executeVerifyTextAsync(root, { quick: true });
		const json = await executeVerifyJsonAsync(root, { quick: true });

		expect(text).toContain("graph scan skipped");
		expect(json.quickMode).toBe(true);
		expect(json.graphSkipped).toBe(true);
		expect(json.symbolCount).toBeNull();
	});
});
