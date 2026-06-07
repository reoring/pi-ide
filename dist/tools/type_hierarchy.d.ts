/**
 * pi-shazam tools/type_hierarchy — LSP type hierarchy + implementations.
 *
 * Uses LSP 3.17 textDocument/typeHierarchy for bidirectional traversal
 * (supertypes and subtypes). Falls back to graph inheritance edges
 * when LSP is unavailable.
 *
 * Absorbs "implementations" lookup — type hierarchy is the superset.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerTypeHierarchy(pi: ExtensionAPI): void;
interface TypeHierarchyEntry {
    name: string;
    kind: string;
    file: string;
    line: number;
    signature: string;
}
interface TypeHierarchyResult {
    symbol: TypeHierarchyEntry;
    supertypes: TypeHierarchyEntry[];
    subtypes: TypeHierarchyEntry[];
}
export declare function executeTypeHierarchy(graph: RepoGraph, name: string, direction?: "both" | "supertypes" | "subtypes"): TypeHierarchyResult;
export {};
//# sourceMappingURL=type_hierarchy.d.ts.map