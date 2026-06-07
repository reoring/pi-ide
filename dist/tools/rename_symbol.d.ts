/**
 * code tools/rename_symbol — LSP cross-file symbol rename.
 *
 * Uses LSP textDocument/rename to perform a cross-file rename.
 * Requires prior call_chain verification for safety.
 * This is a write operation with side effects.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerRenameSymbol(pi: ExtensionAPI): void;
interface RenameResult {
    status: "ok" | "not_found" | "error";
    symbol: string;
    newName: string;
    message: string;
    fileCount?: number;
    changes?: number;
}
export declare function executeRenameSymbol(graph: RepoGraph, symbolName: string, newName: string): RenameResult;
export {};
//# sourceMappingURL=rename_symbol.d.ts.map