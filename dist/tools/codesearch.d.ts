import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph, Symbol } from "../core/graph.js";
import { type EnrichedSymbolHit } from "./lsp_enrich.js";
export declare function registerCodesearch(pi: ExtensionAPI): void;
export declare function executeCodesearch(graph: RepoGraph, query: string, topN?: number): Symbol[];
/**
 * Result type covering both BM25 and LSP sources.
 */
export interface CodesearchHit {
    sym: Symbol;
    score: number;
    source: "bm25" | "lsp" | "lsp+bm25";
}
/**
 * Merge LSP hits with BM25 hits, deduplicating by file+line+name.
 * LSP hits float to the top (via score boost).
 */
export declare function mergeResults(graph: RepoGraph, bm25Syms: Symbol[], lspHits: EnrichedSymbolHit[], topN?: number): CodesearchHit[];
//# sourceMappingURL=codesearch.d.ts.map