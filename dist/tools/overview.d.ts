/**
 * code tools/overview — Project structure summary.
 *
 * Includes HTTP route inventory (absorbed from tools/routes.ts).
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerOverview(pi: ExtensionAPI): void;
export declare function executeOverview(graph: RepoGraph, _projectRoot: string, filter?: string): string;
export declare function executeOverviewJson(graph: RepoGraph, projectRoot: string, filter?: string): string;
/**
 * Full route inventory output (exported for backward-compatible testing).
 */
export declare function executeRoutes(graph: RepoGraph, _projectRoot: string): string;
/**
 * Build a "Key Dependencies" section for the overview.
 * Reads package.json and extracts dependencies + devDependencies (top 15).
 * Returns null when no package.json is found.
 */
export declare function buildKeyDependenciesSection(projectRoot: string): string | null;
/**
 * Build a "Recent Changes" section for the overview.
 * Runs `git log --oneline -10` in the project root.
 * Returns null when git is not available or the command fails.
 */
export declare function buildRecentChangesSection(projectRoot: string): string | null;
//# sourceMappingURL=overview.d.ts.map