/**
 * pi-shazam core/output — Standardized tool output formatting.
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
import { execSync } from "node:child_process";
// ── Graph-aware filter helpers ───────────────────────────────────────────────
const TEST_FILE_PATTERNS = [
    /(?:^|[/.])tests?\//,
    /(?:^|[/.])__tests__\//,
    /\.test\.[a-z]+$/,
    /\.spec\.[a-z]+$/,
    /(?:^|[/.])test_[a-z_]+\.[a-z]+$/,
];
/**
 * True when the graph has at least one file matching test-file heuristics.
 */
export function hasTestFiles(graph) {
    if (!graph)
        return false;
    for (const file of graph.fileSymbols.keys()) {
        for (const pat of TEST_FILE_PATTERNS) {
            if (pat.test(file))
                return true;
        }
    }
    return false;
}
const HIERARCHY_KINDS = new Set(["class", "interface", "type_alias", "struct"]);
/**
 * True when the graph contains at least one class/interface/type_alias symbol.
 */
export function hasHierarchyKinds(graph) {
    if (!graph)
        return false;
    for (const sym of graph.symbols.values()) {
        if (HIERARCHY_KINDS.has(sym.kind))
            return true;
    }
    return false;
}
// ── Rules ────────────────────────────────────────────────────────────────────
/**
 * The single source of truth for Next recommendations. Each rule is a pure
 * function of (context, optional graph). To add a recommendation for a new
 * tool: append a rule here. No switch to edit.
 */
export const NEXT_RULES = [
    // overview
    {
        forTools: ["overview"],
        condition: (ctx) => Boolean(ctx.topFile),
        recommendation: (ctx) => ({
            tool: "file_detail",
            params: { file: ctx.topFile },
            label: "Inspect top file",
            level: "recommended",
        }),
    },
    {
        forTools: ["overview"],
        condition: () => true,
        recommendation: () => ({
            tool: "codesearch",
            params: { query: "<keyword>" },
            label: "Search for related symbols",
            level: "also",
        }),
    },
    // hotspots
    {
        forTools: ["hotspots"],
        condition: (ctx) => Boolean(ctx.topFile),
        recommendation: (ctx) => ({
            tool: "file_detail",
            params: { file: ctx.topFile },
            label: "Inspect top hotspot",
            level: "recommended",
        }),
    },
    {
        forTools: ["hotspots"],
        condition: () => true,
        recommendation: () => ({
            tool: "overview",
            label: "Review project overview",
            level: "also",
        }),
    },
    // symbol
    {
        forTools: ["symbol"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "call_chain",
            params: { symbol: ctx.topSymbol },
            label: "Trace call chain",
            level: "recommended",
        }),
    },
    {
        forTools: ["symbol"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "hover",
            params: { name: ctx.topSymbol },
            label: "Get type info",
            level: "also",
        }),
    },
    // codesearch (find_tests suppressed when graph has no tests)
    {
        forTools: ["codesearch"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "symbol",
            params: { name: ctx.topSymbol },
            label: "View top result details",
            level: "recommended",
        }),
    },
    {
        forTools: ["codesearch"],
        condition: (_ctx, graph) => graph === undefined || hasTestFiles(graph),
        recommendation: () => ({
            tool: "find_tests",
            label: "Find related tests",
            level: "also",
        }),
    },
    // call_chain
    {
        forTools: ["call_chain"],
        condition: () => true,
        recommendation: () => ({
            tool: "impact",
            params: { files: "<caller-file>" },
            label: "Assess blast radius",
            level: "recommended",
        }),
    },
    {
        forTools: ["call_chain"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "hover",
            params: { name: ctx.topSymbol },
            label: "Inspect symbol type",
            level: "also",
        }),
    },
    {
        forTools: ["call_chain"],
        condition: (_ctx, graph) => graph === undefined || hasTestFiles(graph),
        recommendation: () => ({
            tool: "find_tests",
            label: "Find tests for affected modules",
            level: "also",
        }),
    },
    // overview (enhanced)
    {
        forTools: ["overview"],
        condition: (_ctx, graph) => graph === undefined || hasTestFiles(graph),
        recommendation: () => ({
            tool: "find_tests",
            label: "Discover test layout",
            level: "also",
        }),
    },
    {
        forTools: ["overview"],
        condition: (_ctx, graph) => graph === undefined || hasHierarchyKinds(graph),
        recommendation: () => ({
            tool: "type_hierarchy",
            label: "Explore type hierarchy",
            level: "also",
        }),
    },
    // hover (type_hierarchy suppressed when graph has no class/interface)
    {
        forTools: ["hover"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "symbol",
            params: { name: ctx.topSymbol },
            label: "View symbol graph info",
            level: "recommended",
        }),
    },
    {
        forTools: ["hover"],
        condition: (ctx, graph) => Boolean(ctx.topSymbol) && (graph === undefined || hasHierarchyKinds(graph)),
        recommendation: (ctx) => ({
            tool: "type_hierarchy",
            params: { name: ctx.topSymbol },
            label: "Explore type hierarchy",
            level: "also",
        }),
    },
    // file_detail (find_tests suppressed when graph has no tests)
    {
        forTools: ["file_detail"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "symbol",
            params: { name: ctx.topSymbol },
            label: "Inspect top symbol",
            level: "recommended",
        }),
    },
    {
        forTools: ["file_detail"],
        condition: (ctx, graph) => Boolean(ctx.topFile) && (graph === undefined || hasTestFiles(graph)),
        recommendation: (ctx) => ({
            tool: "find_tests",
            params: { sourceFile: ctx.topFile },
            label: "Find tests for this file",
            level: "also",
        }),
    },
    // find_tests
    {
        forTools: ["find_tests"],
        condition: (ctx) => Boolean(ctx.testFunc),
        recommendation: (ctx) => ({
            tool: "call_chain",
            params: { symbol: ctx.testFunc },
            label: "Trace test function",
            level: "recommended",
        }),
    },
    // type_hierarchy
    {
        forTools: ["type_hierarchy"],
        condition: () => true,
        recommendation: () => ({
            tool: "find_tests",
            label: "Find tests for related types",
            level: "recommended",
        }),
    },
    {
        forTools: ["type_hierarchy"],
        condition: () => true,
        recommendation: () => ({
            tool: "hover",
            label: "Get hover info",
            level: "also",
        }),
    },
    // impact
    {
        forTools: ["impact"],
        condition: () => true,
        recommendation: () => ({
            tool: "verify",
            label: "Run verification after changes",
            level: "required",
        }),
    },
    {
        forTools: ["impact"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "call_chain",
            params: { symbol: ctx.topSymbol },
            label: "Trace top impacted symbol",
            level: "recommended",
        }),
    },
    // verify
    {
        forTools: ["verify"],
        condition: (ctx) => Boolean(ctx.orphanCount && ctx.orphanCount > 0),
        recommendation: () => ({
            tool: "call_chain",
            params: { symbol: "<orphan>" },
            label: "Trace orphan symbols",
            level: "recommended",
        }),
    },
    // fix
    {
        forTools: ["fix"],
        condition: () => true,
        recommendation: () => ({
            tool: "verify",
            label: "Verify after fixing",
            level: "required",
        }),
    },
    // rename_symbol
    {
        forTools: ["rename_symbol"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "call_chain",
            params: { symbol: ctx.topSymbol },
            label: "Verify blast radius before rename",
            level: "required",
        }),
    },
    {
        forTools: ["rename_symbol"],
        condition: () => true,
        recommendation: () => ({
            tool: "hover",
            label: "Inspect symbol type",
            level: "also",
        }),
    },
    // safe_delete
    {
        forTools: ["safe_delete"],
        condition: (ctx) => Boolean(ctx.topSymbol),
        recommendation: (ctx) => ({
            tool: "call_chain",
            params: { symbol: ctx.topSymbol },
            label: "Verify zero references before delete",
            level: "required",
        }),
    },
];
/**
 * Build a standardized "Next" section with tool recommendations.
 */
export function formatNextSection(nextItems) {
    if (nextItems.length === 0)
        return "";
    const lines = ["### Next (Recommended)", ""];
    for (const item of nextItems) {
        const label = item.level === "required" ? "REQUIRED" : item.level === "recommended" ? "RECOMMENDED" : "OPTIONAL";
        const cmd = buildToolCommand(item);
        lines.push(`- [${label}] ${item.label}: \`${cmd}\``);
    }
    return lines.join("\n");
}
function buildToolCommand(item) {
    const params = item.params
        ? Object.entries(item.params)
            .map(([k, v]) => `--${k} ${v}`)
            .join(" ")
        : "";
    return `shazam_${item.tool} ${params}`.trim();
}
/**
 * Get standardized Next recommendations for a given tool and context.
 * Driven by the declarative NEXT_RULES array. Adding a new tool =
 * adding rules to NEXT_RULES, not editing this function.
 *
 * Pass the RepoGraph when available to enable graph-aware filters
 * (e.g., suppress find_tests when project has no test files). When
 * graph is undefined, filters preserve legacy (always-emit) behavior.
 */
export function getNextForTool(toolName, context, graph) {
    const ctx = context ?? {};
    const out = [];
    for (const rule of NEXT_RULES) {
        if (!rule.forTools.includes(toolName))
            continue;
        if (!rule.condition(ctx, graph))
            continue;
        const rec = rule.recommendation(ctx);
        if (rec)
            out.push(rec);
    }
    return out;
}
// ── Section builders ──────────────────────────────────────────────────────
/**
 * Build a standardized Result Summary section with key-value pairs.
 */
export function formatResultSummary(title, pairs) {
    const lines = [`## ${title}`, ""];
    for (const [key, value] of pairs) {
        lines.push(`**${key}:** ${value}`);
    }
    lines.push("");
    return lines.join("\n");
}
/**
 * Build a file-item line for the Detail section.
 */
export function formatFileItem(file, line, label, extra) {
    const loc = line > 0 ? `:${line}` : "";
    const suffix = extra ? ` — ${extra}` : "";
    return `- ${label} \`${file}${loc}\`${suffix}`;
}
/**
 * Build the full three-section output for any tool.
 * Each section is optional — pass empty/null to skip.
 */
export function buildToolOutput(resultSection, detailSection, nextSection) {
    const parts = [resultSection.trim()];
    if (detailSection)
        parts.push(detailSection.trim());
    if (nextSection)
        parts.push(nextSection.trim());
    return parts.join("\n\n") + "\n";
}
// ── Context helpers ───────────────────────────────────────────────────────
/**
 * Get the number of uncommitted git changes (for context in output).
 */
export function getGitChangeCount() {
    try {
        const output = execSync("git diff --stat 2>/dev/null | tail -1", { encoding: "utf-8", timeout: 3000 }).trim();
        const match = output.match(/(\d+)\s+file/);
        return match ? parseInt(match[1], 10) : 0;
    }
    catch {
        return -1;
    }
}
/**
 * Get overall project stats from the graph.
 */
export function getGraphSummary(graph) {
    let edgeCount = 0;
    for (const [, edges] of graph.outgoing) {
        edgeCount += edges.length;
    }
    return {
        symbols: graph.symbols.size,
        files: graph.fileSymbols.size,
        edges: edgeCount,
    };
}
// ── Token budget truncation ─────────────────────────────────────────────────
const CHARS_PER_TOKEN = 4;
/**
 * Estimate token count for a text string using ~4 chars/token heuristic.
 * No external dependency — fast enough for inline use during formatting.
 */
export function estimateTokens(text) {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}
function isHighPriorityLine(line) {
    if (line.startsWith("## "))
        return true;
    if (line.startsWith("### "))
        return true;
    if (line.startsWith("**") && line.includes(":**"))
        return true;
    return false;
}
/**
 * Truncate an array of output lines to fit within a token budget.
 * Preserves high-priority lines (headers, key-value pairs) and top items.
 * Low-priority lines are replaced with "... and N more (truncated)".
 */
export function truncateOutput(lines, maxTokens) {
    if (lines.length === 0)
        return "";
    const totalTokens = estimateTokens(lines.join("\n"));
    if (totalTokens <= maxTokens) {
        return lines.join("\n");
    }
    const kept = [];
    let usedTokens = 0;
    let truncatedCount = 0;
    let truncating = false;
    for (const line of lines) {
        const lineTokens = estimateTokens(line);
        if (isHighPriorityLine(line)) {
            kept.push(line);
            usedTokens += lineTokens;
            continue;
        }
        if (truncating || usedTokens + lineTokens > maxTokens) {
            truncating = true;
            truncatedCount++;
            continue;
        }
        kept.push(line);
        usedTokens += lineTokens;
    }
    if (truncatedCount > 0) {
        kept.push(`... and ${truncatedCount} more (truncated)`);
    }
    return kept.join("\n");
}
//# sourceMappingURL=output.js.map