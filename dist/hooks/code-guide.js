/**
 * Check if a tool result contains caller count and suggest call_chain for high-risk symbols.
 */
function hasManyCallers(content) {
    if (!content)
        return null;
    for (const item of content) {
        if (item && typeof item === "object" && "text" in item) {
            const text = item.text;
            // Look for caller count patterns: "N callers" or "N references"
            const callerMatch = text.match(/(\d+) callers?/i);
            const refMatch = text.match(/(\d+) references?/i);
            const symbolMatch = text.match(/`([^`]+)`/);
            const symbolName = symbolMatch ? symbolMatch[1] : null;
            // Extract the actual number (callers is more precise than references)
            const count = callerMatch
                ? parseInt(callerMatch[1], 10)
                : refMatch
                    ? parseInt(refMatch[1], 10)
                    : 0;
            if (count >= 5 && symbolName) {
                return symbolName;
            }
        }
    }
    return null;
}
/**
 * Check if tool result mentions multiple changed files (for impact suggestion).
 */
function hasMultiFileEdit(content) {
    if (!content)
        return false;
    for (const item of content) {
        if (item && typeof item === "object" && "text" in item) {
            const text = item.text;
            const fileMatches = text.match(/(\d+) files?/gi);
            if (fileMatches) {
                for (const m of fileMatches) {
                    const num = parseInt(m.match(/\d+/)?.[0] || "0", 10);
                    if (num >= 2)
                        return true;
                }
            }
        }
    }
    return false;
}
export function registerCodeGuide(pi) {
    pi.on("before_agent_start", (_event, _ctx) => {
        const sp = Array.isArray(_event.systemPrompt) ? _event.systemPrompt.join("\n") : String(_event.systemPrompt ?? "");
        if (sp.includes("code tools available"))
            return;
        return {
            systemPrompt: [
                sp,
                "",
                "14 code tools available this session:",
                "  code_overview — project structure, deps, git history in one call",
                "  code_impact   — check blast radius before editing multiple files",
                "  code_search — ranked code search, more precise than grep",
                "  code_symbol   — locate a function/class definition and its callers",
                "  code_hover     — type signatures and JSDoc via LSP",
                "  code_file_detail — see all symbols and dependencies in a file",
                "  code_call_chain — trace every caller before changing a function",
                "  code_find_tests — discover test files for any module",
                "  code_hotspots  — find the most complex, highest-risk files",
                "  code_type_hierarchy — full class inheritance chain",
                "  code_verify    — check for errors after every edit (PASS/WARN/FAIL)",
                "  code_fix       — auto-fix format and lint issues",
                "  code_rename_symbol  — safe rename, verify references first",
                "  code_safe_delete    — confirm zero references before removing",
            ].join("\n"),
        };
    });
    pi.on("tool_result", (event, ctx) => {
        // After write/edit: suggest verify
        if (event.toolName === "write" || event.toolName === "edit") {
            if (event.isError)
                return;
            ctx.ui?.notify?.("reminder: code_verify checks for errors after editing", "info");
            // Check if multi-file edit was done — suggest impact analysis
            if (hasMultiFileEdit(event.content)) {
                ctx.ui?.notify?.("suggestion: you edited multiple files — code_impact assesses blast radius before continuing", "info");
            }
            return;
        }
        // After code_symbol: suggest call_chain for symbols with many callers
        if (event.toolName === "code_symbol") {
            const symbolName = hasManyCallers(event.content);
            if (symbolName && !event.isError) {
                ctx.ui?.notify?.(`recommended: code_call_chain --symbol ${symbolName} traces all callers before changing this symbol`, "info");
            }
            return;
        }
        // After code_verify FAIL/WARN: suggest remediation
        if (event.toolName === "code_verify" && !event.isError) {
            const texts = [];
            if (event.content) {
                for (const c of event.content) {
                    if (typeof c === "object" && "text" in c)
                        texts.push(c.text);
                }
            }
            const combined = texts.join("\n");
            if (combined.includes("[FAIL]")) {
                ctx.ui?.notify?.("code_verify reported FAIL — fix errors before proceeding", "warning");
            }
            else if (combined.includes("[WARN]")) {
                ctx.ui?.notify?.("code_verify reported WARN — review warnings, then run code_fix if needed", "info");
            }
            else if (combined.includes("[PASS]")) {
                ctx.ui?.notify?.("code_verify passed — changes look good", "info");
            }
            return;
        }
        // After code_file_detail: suggest find_tests if file might have tests
        if (event.toolName === "code_file_detail" && !event.isError) {
            const texts = [];
            if (event.content) {
                for (const c of event.content) {
                    if (typeof c === "object" && "text" in c)
                        texts.push(c.text);
                }
            }
            const combined = texts.join("\n");
            // Extract the file name from the file detail output
            const fileMatch = combined.match(/^## (.+?)(?:\s|$)/m) || combined.match(/File: `([^`]+)`/);
            if (fileMatch) {
                const fileName = fileMatch[1] || fileMatch[0];
                ctx.ui?.notify?.(`suggestion: code_find_tests --sourceFile ${fileName} finds tests for this file`, "info");
            }
        }
    });
    pi.on("tool_call", (event, ctx) => {
        const name = event.toolName;
        // Suggest codesearch over grep/search/find
        if (name === "search" || name === "grep" || name === "find") {
            ctx.ui?.notify?.("reminder: code_search gives ranked results, try it instead of grep", "info");
            return;
        }
        // Before impact: suggest verifying first if there are uncommitted changes
        if (name === "code_impact") {
            ctx.ui?.notify?.("tip: run code_verify first to establish a baseline before assessing impact", "info");
            return;
        }
        // Before rename_symbol: suggest call_chain first
        if (name === "code_rename_symbol") {
            ctx.ui?.notify?.("tip: run code_call_chain first to verify all references before renaming", "info");
            return;
        }
    });
}
