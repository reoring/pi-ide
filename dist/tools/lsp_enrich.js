import { uriToPath } from "../lsp/client.js";
import { readFileAdaptive } from "../core/encoding.js";
// ── Constants ────────────────────────────────────────────────────────────────
export const DEFAULT_LSP_ENRICH_TIMEOUT_MS = 5000;
// ── Timeout helper ───────────────────────────────────────────────────────────
/**
 * Race a promise against a timeout. Returns null on timeout.
 */
export function withEnrichTimeout(promise, ms = DEFAULT_LSP_ENRICH_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            // Silence the original promise to prevent unhandled rejections
            // if it resolves/rejects after timeout.
            void promise.catch(() => { });
            resolve(null);
        }, ms);
        promise
            .then((v) => {
            clearTimeout(timer);
            resolve(v ?? null);
        })
            .catch(() => {
            clearTimeout(timer);
            resolve(null);
        });
    });
}
// ── SymbolKind mapping ───────────────────────────────────────────────────────
/**
 * Map LSP SymbolKind numeric enum (1..26) to the string kind values
 * used by core/graph.ts. Unknown values fall back to "symbol".
 */
export function mapSymbolKindNumber(kind) {
    switch (kind) {
        case 1:
            return "file";
        case 2:
            return "module";
        case 3:
            return "namespace";
        case 4:
            return "package";
        case 5:
            return "class";
        case 6:
            return "method";
        case 7:
            return "property";
        case 8:
            return "field";
        case 9:
            return "constructor";
        case 10:
            return "enum";
        case 11:
            return "interface";
        case 12:
            return "function";
        case 13:
            return "variable";
        case 14:
            return "constant";
        case 15:
            return "string";
        case 16:
            return "number";
        case 17:
            return "boolean";
        case 18:
            return "array";
        case 19:
            return "object";
        case 20:
            return "key";
        case 21:
            return "null";
        case 22:
            return "enum_member";
        case 23:
            return "struct";
        case 24:
            return "event";
        case 25:
            return "operator";
        case 26:
            return "type_alias";
        default:
            return "symbol";
    }
}
// ── File opening helper ──────────────────────────────────────────────────────
/**
 * Ensure a file is opened in its LSP server (best-effort, swallow errors).
 * Reads file content via fs and sends didOpen if not already opened.
 */
async function ensureFileOpened(ctx, filePath) {
    const info = ctx.getServerForFile(filePath);
    if (!info)
        return null;
    if (!info.client.isRunning())
        return null;
    try {
        if (!info.client.isFileOpened(filePath)) {
            const { resolve } = await import("node:path");
            const absPath = resolve(info.workspaceRoot, filePath);
            const content = readFileAdaptive(absPath);
            await info.client.didOpen(filePath, content);
        }
    }
    catch {
        return null;
    }
    return { client: info.client, workspaceRoot: info.workspaceRoot };
}
// ── workspace/symbol ─────────────────────────────────────────────────────────
/**
 * Query workspace/symbol across all active LSP servers.
 * Returns merged results. Empty array if no server or timeout.
 */
export async function lspWorkspaceSearch(ctx, query, timeoutMs = DEFAULT_LSP_ENRICH_TIMEOUT_MS) {
    if (!ctx)
        return [];
    const servers = ctx.getActiveServers();
    if (servers.length === 0)
        return [];
    const promises = servers.map(async (srv) => {
        if (!srv.client.isRunning())
            return [];
        const cap = srv.client.serverCapabilities;
        if (!cap || !cap.workspaceSymbolProvider) {
            return [];
        }
        try {
            const raw = await withEnrichTimeout(srv.client.workspaceSymbol(query), timeoutMs);
            if (!raw)
                return [];
            return raw.map((s) => toEnrichedHit(s)).filter(Boolean);
        }
        catch {
            return [];
        }
    });
    const settled = await Promise.allSettled(promises);
    const out = [];
    for (const r of settled) {
        if (r.status === "fulfilled") {
            for (const hit of r.value)
                out.push(hit);
        }
    }
    return out;
}
function toEnrichedHit(s) {
    const kind = mapSymbolKindNumber(s.kind);
    if ("location" in s && s.location) {
        const loc = s.location;
        if (!loc.range)
            return null;
        const file = uriToPath(loc.uri);
        return {
            name: s.name,
            kind,
            file,
            line: loc.range.start.line + 1,
            endLine: loc.range.end.line + 1,
            col: loc.range.start.character + 1,
            endCol: loc.range.end.character + 1,
            containerName: "containerName" in s ? s.containerName : undefined,
            source: "lsp",
        };
    }
    return null;
}
// ── documentSymbol enrichment ────────────────────────────────────────────────
/**
 * Fetch LSP documentSymbol hierarchy for a file.
 * Returns null on timeout, no server, or file not opened.
 */
export async function lspDocumentSymbols(ctx, filePath, timeoutMs = DEFAULT_LSP_ENRICH_TIMEOUT_MS) {
    if (!ctx)
        return null;
    const opened = await ensureFileOpened(ctx, filePath);
    if (!opened)
        return null;
    const cap = opened.client.serverCapabilities;
    if (!cap || !cap.documentSymbolProvider) {
        return null;
    }
    return withEnrichTimeout(opened.client.documentSymbols(filePath), timeoutMs);
}
// ── semanticTokens ───────────────────────────────────────────────────────────
/**
 * Fetch full semantic tokens for a file.
 * Returns null on timeout, no server, unsupported, or file not opened.
 */
export async function lspSemanticTokens(ctx, filePath, timeoutMs = DEFAULT_LSP_ENRICH_TIMEOUT_MS) {
    if (!ctx)
        return null;
    const opened = await ensureFileOpened(ctx, filePath);
    if (!opened)
        return null;
    const cap = opened.client.serverCapabilities;
    const stProvider = cap?.semanticTokensProvider;
    if (!stProvider)
        return null;
    return withEnrichTimeout(opened.client.semanticTokens(filePath), timeoutMs);
}
// ── foldingRange ─────────────────────────────────────────────────────────────
/**
 * Fetch folding ranges for a file.
 * Returns null on timeout, no server, unsupported, or file not opened.
 */
export async function lspFoldingRanges(ctx, filePath, timeoutMs = DEFAULT_LSP_ENRICH_TIMEOUT_MS) {
    if (!ctx)
        return null;
    const opened = await ensureFileOpened(ctx, filePath);
    if (!opened)
        return null;
    const cap = opened.client.serverCapabilities;
    if (!cap || !cap.foldingRangeProvider) {
        return null;
    }
    return withEnrichTimeout(opened.client.foldingRange(filePath), timeoutMs);
}
//# sourceMappingURL=lsp_enrich.js.map