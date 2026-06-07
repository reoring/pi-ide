/**
 * pi-shazam tools/fix — Auto-fix lint/format.
 *
 * Scans source files for common format issues and offers fixes.
 * In dry-run mode, previews what would change without modifying files.
 * Supports nearest-wins formatter detection (prettier, biome, eslint, ruff, gofmt).
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerFix(pi: ExtensionAPI): void;
export interface FixOptions {
    /** Dry-run mode: preview changes without applying */
    dryRun?: boolean;
    /** Target specific file (omit for all files) */
    file?: string;
}
/**
 * Run format fix analysis. In dry-run mode (default), only reports issues.
 */
export declare function executeFix(graph: RepoGraph, projectRoot: string, options?: FixOptions): string;
/**
 * Run fix analysis and return structured JSON.
 */
export declare function executeFixJson(graph: RepoGraph, projectRoot: string, options?: FixOptions): string;
//# sourceMappingURL=fix.d.ts.map