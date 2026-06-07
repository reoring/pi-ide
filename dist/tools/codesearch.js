/**
 * code tools/codesearch — BM25 symbol search with optional LSP enrichment.
 *
 * When LSP servers are running and advertise workspaceSymbolProvider,
 * workspace/symbol results are merged with BM25 scores. LSP hits get
 * a +50 score boost so they float to the top. Output is annotated
 * "(LSP enriched)" or "(tree-sitter only)" accordingly.
 */
import { readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { scanProject } from "../core/scanner.js";
import { SKIP_DIRS, isNonSourceFile } from "../core/filter.js";
import { getNextForTool, formatNextSection, truncateOutput } from "../core/output.js";
import { getLspManager } from "./_context.js";
import { lspWorkspaceSearch } from "./lsp_enrich.js";
import { createTool } from "./_factory.js";
const LSP_BOOST = 50;
export function registerCodesearch(pi) {
    createTool(pi, {
        name: "code_search",
        label: "Code Search (BM25)",
        description: `\
		Don't reach for grep or raw text search across the codebase. Use this
		instead — it ranks results by relevance (BM25), understands
		camelCase/snake_case token boundaries, and enriches hits with LSP
		workspace symbols. Two modes: target="symbol" (default, semantic
		ranking) and target="code" (full-text with context snippets via
		ripgrep).`,
        params: Type.Object({
            query: Type.String(),
            target: Type.Optional(Type.Union([Type.Literal("symbol"), Type.Literal("code")])),
            topN: Type.Optional(Type.Number()),
        }),
        customExecute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
            const json = params.json ?? false;
            const target = params.target ?? "symbol";
            const maxTokens = params.maxTokens;
            if (target === "code") {
                const result = executeFulltextSearch(params.query, params.topN);
                let text = json
                    ? JSON.stringify({
                        schema_version: "1.0",
                        command: "code_search",
                        status: "ok",
                        result: { query: params.query, target: "code", results: result.length },
                    })
                    : formatFulltextResult(result, params.query);
                if (maxTokens && !json) {
                    text = truncateOutput(text.split("\n"), maxTokens);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text,
                        },
                    ],
                };
            }
            const graph = scanProject(".");
            // BM25 + LSP workspace/symbol in parallel
            const bm25Results = executeCodesearch(graph, params.query, params.topN);
            const lspManager = getLspManager();
            const lspResults = await lspWorkspaceSearch(lspManager, params.query, 5000);
            const merged = mergeResults(graph, bm25Results, lspResults, params.topN);
            const source = lspResults.length > 0 ? "lsp+bm25" : "bm25";
            let text = json
                ? JSON.stringify({
                    schema_version: "1.0",
                    command: "code_search",
                    status: "ok",
                    result: {
                        query: params.query,
                        target: "symbol",
                        results: merged.length,
                        source,
                    },
                })
                : formatCodesearchResult(merged, params.query, source);
            if (maxTokens && !json) {
                text = truncateOutput(text.split("\n"), maxTokens);
            }
            return {
                content: [
                    {
                        type: "text",
                        text,
                    },
                ],
            };
        },
    });
}
export function executeCodesearch(graph, query, topN) {
    const limit = topN ?? 20;
    const lower = query.toLowerCase();
    const tokens = tokenize(query);
    const scored = [];
    for (const sym of graph.symbols.values()) {
        // Skip non-source files (config, generated, lockfiles)
        if (isNonSourceFile(sym.file))
            continue;
        const nameLower = sym.name.toLowerCase();
        let score = 0;
        // Exact match
        if (nameLower === lower) {
            score += 100;
        }
        // Substring match
        if (nameLower.includes(lower)) {
            score += 30;
        }
        // Token matching (camelCase/snake_case)
        for (const token of tokens) {
            if (nameLower.includes(token)) {
                score += 10;
            }
        }
        // PageRank boost
        score += sym.pagerank * 50;
        if (score > 0) {
            scored.push({ sym, score });
        }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.sym);
}
function tokenize(query) {
    const tokens = [];
    // Split camelCase
    const camelTokens = query.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    // Split snake_case and other separators
    const parts = camelTokens.split(/[\s_\-.:/]+/);
    for (const p of parts) {
        if (p.length >= 2)
            tokens.push(p);
    }
    return tokens;
}
/**
 * Merge LSP hits with BM25 hits, deduplicating by file+line+name.
 * LSP hits float to the top (via score boost).
 */
export function mergeResults(graph, bm25Syms, lspHits, topN) {
    const limit = topN ?? 20;
    const seen = new Set();
    const out = [];
    // Score BM25 results by position (preserves their ranking)
    let bm25Score = 1000;
    const bm25ById = new Map();
    for (const sym of bm25Syms) {
        bm25ById.set(sym.id, bm25Score);
        bm25Score -= 1;
    }
    // LSP hits first
    for (const hit of lspHits) {
        const key = `${hit.file}:${hit.line}:${hit.name}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const graphSym = findGraphSymbol(graph, hit.name, hit.file, hit.line);
        if (graphSym) {
            const base = bm25ById.get(graphSym.id) ?? 0;
            out.push({ sym: graphSym, score: base + LSP_BOOST, source: "lsp+bm25" });
        }
        else {
            // Synthesize a Symbol from LSP hit
            const synth = {
                id: `${hit.file}::${hit.name}::${hit.line}`,
                name: hit.name,
                kind: hit.kind,
                file: hit.file,
                line: hit.line,
                endLine: hit.endLine,
                col: hit.col,
                visibility: "public",
                docstring: "",
                signature: "",
                returnType: "",
                params: "",
                pagerank: 0,
            };
            out.push({ sym: synth, score: 1000 + LSP_BOOST, source: "lsp" });
        }
    }
    // BM25 hits next, skipping duplicates
    for (const sym of bm25Syms) {
        const key = `${sym.file}:${sym.line}:${sym.name}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push({ sym, score: bm25ById.get(sym.id) ?? 0, source: "bm25" });
        if (out.length >= limit)
            break;
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
}
function findGraphSymbol(graph, name, file, line) {
    const ids = graph.fileSymbols.get(file);
    if (!ids)
        return undefined;
    for (const id of ids) {
        const sym = graph.symbols.get(id);
        if (sym && sym.name === name && Math.abs(sym.line - line) <= 2) {
            return sym;
        }
    }
    return undefined;
}
function formatCodesearchResult(results, query, source) {
    if (results.length === 0) {
        return `No symbols found for query: "${query}"`;
    }
    const sourceLabel = source === "lsp+bm25" ? " (LSP enriched)" : " (tree-sitter only)";
    const lines = [`## Code Search: "${query}" (${results.length} results)${sourceLabel}`, ""];
    for (let i = 0; i < results.length; i++) {
        const hit = results[i];
        const srcTag = hit.source === "lsp" ? " [LSP]" : hit.source === "lsp+bm25" ? " [LSP+BM25]" : "";
        lines.push(`${i + 1}. ${hit.sym.kind} \`${hit.sym.name}\`${srcTag} — ${hit.sym.file}:${hit.sym.line} (PR ${hit.sym.pagerank.toFixed(3)})`);
    }
    const nextItems = getNextForTool("codesearch", {
        topSymbol: results[0]?.sym.name,
    });
    if (nextItems.length > 0) {
        lines.push("");
        lines.push(formatNextSection(nextItems));
    }
    return lines.join("\n");
}
export function executeFulltextSearch(query, topN) {
    const limit = topN ?? 20;
    // Try ripgrep first (fastest, respects .gitignore)
    if (existsSync("/usr/bin/rg") ||
        existsSync("/usr/local/bin/rg") ||
        execSync("which rg 2>/dev/null || true").toString().trim()) {
        try {
            const output = execSync(`rg --no-heading -n --max-count 20 --context 1 -i -g '!.git' -g '!node_modules' -g '!dist' -g '!build' -g '!.tmp/**' -g '!_agents/**' -g '!*.lock' -g '!package-lock.json' -g '!yarn.lock' -g '!pnpm-lock.yaml' -- ${JSON.stringify(query)} . 2>/dev/null | head -${limit * 3}`, { encoding: "utf-8", timeout: 5000 });
            return parseRipgrepOutput(output, query, limit);
        }
        catch {
            // ripgrep found nothing or errored — fall through to built-in
        }
    }
    // Fallback: built-in file scan
    return builtinFulltextSearch(query, limit);
}
function parseRipgrepOutput(output, query, limit) {
    const results = [];
    const lines = output.split("\n").filter(Boolean);
    // rg --context 1 outputs alternating content/context lines
    for (let i = 0; i < lines.length && results.length < limit; i++) {
        const line = lines[i];
        // Skip context lines (starting with -)
        if (line.startsWith("-"))
            continue;
        const match = line.match(/^([^:]+):(\d+):(.+)/);
        if (match) {
            results.push({
                file: match[1].replace(/^\.\//, ""),
                line: parseInt(match[2], 10),
                column: match[3].search(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")) + 1 || 1,
                text: match[3].trim(),
            });
        }
    }
    return results;
}
function builtinFulltextSearch(query, limit) {
    const results = [];
    const lower = query.toLowerCase();
    const projectRoot = process.cwd();
    // Directories to skip
    const skipDirs = new Set([".git", "node_modules", "dist", "build", ".next", ".cache", "target", "__pycache__", ...SKIP_DIRS]);
    const skipFiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", ".min.js", ".min.css"];
    function scanDir(dir) {
        if (results.length >= limit)
            return;
        let entries = [];
        try {
            entries = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry === "." || entry === "..")
                continue;
            const fullPath = join(dir, entry);
            // Skip hidden files/dirs (except .github)
            if (entry.startsWith(".") && entry !== ".github")
                continue;
            if (skipDirs.has(entry))
                continue;
            if (skipFiles.some((s) => entry.includes(s)))
                continue;
            try {
                const st = statSync(fullPath);
                if (st.isDirectory()) {
                    scanDir(fullPath);
                }
                else {
                    // Check if it's a text file by extension
                    const ext = entry.split(".").pop()?.toLowerCase();
                    const textExts = new Set([
                        "ts",
                        "tsx",
                        "js",
                        "jsx",
                        "py",
                        "rs",
                        "go",
                        "java",
                        "kt",
                        "swift",
                        "c",
                        "cpp",
                        "h",
                        "hpp",
                        "css",
                        "scss",
                        "less",
                        "html",
                        "vue",
                        "svelte",
                        "json",
                        "yaml",
                        "yml",
                        "toml",
                        "md",
                        "txt",
                        "xml",
                        "svg",
                        "sh",
                        "bash",
                        "zsh",
                        "sql",
                        "graphql",
                        "prisma",
                    ]);
                    if (ext && !textExts.has(ext))
                        continue;
                    const content = readFileSync(fullPath, "utf-8");
                    const lines = content.split("\n");
                    for (let i = 0; i < lines.length && results.length < limit; i++) {
                        if (lines[i].toLowerCase().includes(lower)) {
                            results.push({
                                file: fullPath.replace(projectRoot + "/", ""),
                                line: i + 1,
                                column: lines[i].toLowerCase().indexOf(lower) + 1,
                                text: lines[i].trim(),
                            });
                        }
                    }
                }
            }
            catch {
                // skip unreadable files
            }
        }
    }
    scanDir(projectRoot);
    return results;
}
export function formatFulltextResult(results, query) {
    if (results.length === 0) {
        return `No results found for query: "${query}"`;
    }
    const lines = [`## Full-Text Search: "${query}" (${results.length} results)`, ""];
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        lines.push(`${i + 1}. \`${r.file}:${r.line}:${r.column}\` — ${r.text.length > 80 ? r.text.slice(0, 80) + "..." : r.text}`);
    }
    // Add Next recommendations
    const nextItems = getNextForTool("codesearch");
    if (nextItems.length > 0) {
        lines.push("");
        lines.push(formatNextSection(nextItems));
    }
    return lines.join("\n");
}
