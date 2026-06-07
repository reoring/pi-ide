/**
 * pi-ide core/output — Standardized tool output formatting.
 *
 * All tool outputs follow a three-section skeleton:
 *   1. ## Result Summary (key-value table / quick summary)
 *   2. ### Detail (per-item expansion)
 *   3. ### Next (actionable tool recommendations)
 *
 * This module provides builders for each section. The Next recommendation
 * system is driven by a declarative rule array (NEXT_RULES) — adding a
 * new tool = adding rules, not editing a switch. Rules can evaluate against
 * the RepoGraph to suppress irrelevant recommendations (e.g., no find_tests
 * when project has zero test files).
 */
import type { RepoGraph } from "./graph.js";
export type NextLevel = "required" | "recommended" | "also";
export interface NextRecommendation {
    tool: string;
    params?: Record<string, string | number | boolean>;
    label: string;
    level: NextLevel;
}
/**
 * Runtime context passed by each tool when asking for Next recommendations.
 * Fields are optional — rules check only what they need.
 */
export interface NextContext {
    topFile?: string;
    topSymbol?: string;
    hasErrors?: boolean;
    hasFixes?: boolean;
    riskLevel?: string;
    orphanCount?: number;
    testFunc?: string;
    handlerFile?: string;
    usageFile?: string;
    brokenFile?: string;
}
/**
 * Declarative rule: for a set of tools, when condition holds, emit
 * recommendation. The recommendation is a factory so it can read context
 * (e.g., substitute topFile into --file).
 *
 * - `forTools`: tool names this rule applies to
 * - `condition`: returns true to emit; receives context + optional graph.
 *   When graph is undefined (legacy callers), graph-aware rules must
 *   short-circuit to preserve backward-compatible output.
 * - `recommendation`: factory returning the recommendation, or null to skip.
 */
export interface NextRule {
    forTools: string[];
    condition: (ctx: NextContext, graph?: RepoGraph) => boolean;
    recommendation: (ctx: NextContext) => NextRecommendation | null;
}
/**
 * True when the graph has at least one file matching test-file heuristics.
 */
export declare function hasTestFiles(graph?: RepoGraph): boolean;
/**
 * True when the graph contains at least one class/interface/type_alias symbol.
 */
export declare function hasHierarchyKinds(graph?: RepoGraph): boolean;
/**
 * The single source of truth for Next recommendations. Each rule is a pure
 * function of (context, optional graph). To add a recommendation for a new
 * tool: append a rule here. No switch to edit.
 */
export declare const NEXT_RULES: NextRule[];
/**
 * Build a standardized "Next" section with tool recommendations.
 */
export declare function formatNextSection(nextItems: NextRecommendation[]): string;
/**
 * Get standardized Next recommendations for a given tool and context.
 * Driven by the declarative NEXT_RULES array. Adding a new tool =
 * adding rules to NEXT_RULES, not editing this function.
 *
 * Pass the RepoGraph when available to enable graph-aware filters
 * (e.g., suppress find_tests when project has no test files). When
 * graph is undefined, filters preserve legacy (always-emit) behavior.
 */
export declare function getNextForTool(toolName: string, context?: NextContext, graph?: RepoGraph): NextRecommendation[];
/**
 * Build a standardized Result Summary section with key-value pairs.
 */
export declare function formatResultSummary(title: string, pairs: [string, string | number][]): string;
/**
 * Build a file-item line for the Detail section.
 */
export declare function formatFileItem(file: string, line: number, label: string, extra?: string): string;
/**
 * Build the full three-section output for any tool.
 * Each section is optional — pass empty/null to skip.
 */
export declare function buildToolOutput(resultSection: string, detailSection: string | null, nextSection: string | null): string;
/**
 * Get the number of uncommitted git changes (for context in output).
 */
export declare function getGitChangeCount(): number;
/**
 * Get overall project stats from the graph.
 */
export declare function getGraphSummary(graph: RepoGraph): {
    symbols: number;
    files: number;
    edges: number;
};
/**
 * Estimate token count for a text string using ~4 chars/token heuristic.
 * No external dependency — fast enough for inline use during formatting.
 */
export declare function estimateTokens(text: string): number;
/**
 * Truncate an array of output lines to fit within a token budget.
 * Preserves high-priority lines (headers, key-value pairs) and top items.
 * Low-priority lines are replaced with "... and N more (truncated)".
 */
export declare function truncateOutput(lines: string[], maxTokens: number): string;
//# sourceMappingURL=output.d.ts.map