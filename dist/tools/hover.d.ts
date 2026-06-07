/**
 * code tools/hover — Symbol type/documentation hover.
 *
 * Uses LSP textDocument/hover to get type information and documentation
 * for a symbol at a given position. Falls back to graph metadata when
 * LSP is unavailable.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerHover(pi: ExtensionAPI): void;
interface HoverResult {
    name: string;
    file: string;
    line: number;
    kind: string;
    signature: string;
    pagerank: number;
    lspHover?: string;
}
export declare function executeHover(graph: RepoGraph, name: string, file?: string): Promise<HoverResult>;
export {};
//# sourceMappingURL=hover.d.ts.map