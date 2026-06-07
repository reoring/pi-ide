/**
 * pi-shazam tools/file_detail — Single file deep analysis.
 *
 * When LSP is available, augments tree-sitter symbol list with a
 * parent-child hierarchy section from documentSymbol. Falls back to
 * flat list with "(tree-sitter only)" annotation when LSP unavailable.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerFileDetail(pi: ExtensionAPI): void;
export declare function executeFileDetail(graph: RepoGraph, file: string): string;
export declare function executeFileDetailJson(graph: RepoGraph, file: string): string;
//# sourceMappingURL=file_detail.d.ts.map