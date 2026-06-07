/**
 * code tools/lsp_enrich — Tool-layer wrappers for LSP enrichment.
 *
 * Provides helpers that tools/ call to enrich tree-sitter graph data
 * with LSP results (workspace/symbol, documentSymbol, semanticTokens,
 * foldingRange). Each helper:
 *   - Returns null/empty on any failure (timeout, no server, file not opened)
 *   - Never throws into tool code
 *   - Runs within a configurable timeout (default 5000ms)
 *
 * Layer rule: tools/ -> lsp/ is allowed. core/ -> lsp/ is NOT.
 * These helpers live here to preserve that boundary.
 */
import type { LspClient } from "../lsp/client.js";
import type { SymbolInformation, DocumentSymbol, SemanticTokens, FoldingRange } from "vscode-languageserver-protocol";
export declare const DEFAULT_LSP_ENRICH_TIMEOUT_MS = 5000;
/**
 * Minimal LspManager-like surface used by helpers.
 * Accepts the real LspManager or a test stub.
 */
export interface LspEnrichContext {
    getServerForFile(filePath: string): {
        language: string;
        client: LspClient;
        workspaceRoot: string;
    } | null;
    getActiveServers(): {
        language: string;
        client: LspClient;
        workspaceRoot: string;
    }[];
}
export interface EnrichedSymbolHit {
    name: string;
    kind: string;
    file: string;
    line: number;
    endLine: number;
    col: number;
    endCol: number;
    containerName?: string;
    source: "lsp";
}
/**
 * Race a promise against a timeout. Returns null on timeout.
 */
export declare function withEnrichTimeout<T>(promise: Promise<T | null | undefined>, ms?: number): Promise<T | null>;
/**
 * Map LSP SymbolKind numeric enum (1..26) to the string kind values
 * used by core/graph.ts. Unknown values fall back to "symbol".
 */
export declare function mapSymbolKindNumber(kind: number): string;
/**
 * Query workspace/symbol across all active LSP servers.
 * Returns merged results. Empty array if no server or timeout.
 */
export declare function lspWorkspaceSearch(ctx: LspEnrichContext | null, query: string, timeoutMs?: number): Promise<EnrichedSymbolHit[]>;
/**
 * Fetch LSP documentSymbol hierarchy for a file.
 * Returns null on timeout, no server, or file not opened.
 */
export declare function lspDocumentSymbols(ctx: LspEnrichContext | null, filePath: string, timeoutMs?: number): Promise<DocumentSymbol[] | SymbolInformation[] | null>;
/**
 * Fetch full semantic tokens for a file.
 * Returns null on timeout, no server, unsupported, or file not opened.
 */
export declare function lspSemanticTokens(ctx: LspEnrichContext | null, filePath: string, timeoutMs?: number): Promise<SemanticTokens | null>;
/**
 * Fetch folding ranges for a file.
 * Returns null on timeout, no server, unsupported, or file not opened.
 */
export declare function lspFoldingRanges(ctx: LspEnrichContext | null, filePath: string, timeoutMs?: number): Promise<FoldingRange[] | null>;
//# sourceMappingURL=lsp_enrich.d.ts.map