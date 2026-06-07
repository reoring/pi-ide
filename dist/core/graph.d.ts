/**
 * pi-shazam core/graph — Symbol dependency graph data model.
 *
 * Ported from repomap/src/__init__.py (Symbol, Edge, RepoGraph dataclasses).
 * All other core/ modules depend on these types.
 */
/** A code symbol (function, class, interface, etc.) */
export interface Symbol {
    id: string;
    name: string;
    kind: string;
    file: string;
    line: number;
    endLine: number;
    col: number;
    visibility: "public" | "private" | "exported";
    docstring: string;
    signature: string;
    returnType: string;
    params: string;
    pagerank: number;
}
/** A directed edge in the dependency graph */
export interface Edge {
    source: string;
    target: string;
    weight: number;
    kind: string;
    confidence: number;
}
/** Full symbol dependency graph */
export interface RepoGraph {
    symbols: Map<string, Symbol>;
    outgoing: Map<string, Edge[]>;
    incoming: Map<string, Edge[]>;
    fileSymbols: Map<string, string[]>;
    fileImports: Map<string, string[]>;
    fileCalls: Map<string, [string, number, string][]>;
    fileImportBindings: Map<string, JSImportBinding[]>;
    fileExports: Map<string, JSExportBinding[]>;
}
/** A JS/TS import binding */
export interface JSImportBinding {
    localName: string;
    importedName: string;
    module: string;
    line: number;
    kind: "default" | "named" | "namespace";
}
/** A JS/TS export binding */
export interface JSExportBinding {
    exportedName: string;
    sourceName: string | null;
    module: string | null;
    line: number;
    kind: "local" | "reexport" | "namespace" | "wildcard";
}
export declare function createRepoGraph(): RepoGraph;
export declare function createSymbol(id: string, name: string, kind: string, file: string, line: number, overrides?: Partial<Symbol>): Symbol;
export declare function createEdge(source: string, target: string, weight: number, kind: string, confidence?: number): Edge;
export interface SerializedSymbol {
    id: string;
    name: string;
    kind: string;
    file: string;
    line: number;
    endLine: number;
    col: number;
    visibility: string;
    signature: string;
    returnType: string;
    params: string;
    docstring: string;
    pagerank: number;
}
export interface SerializedEdge {
    source: string;
    target: string;
    weight: number;
    kind: string;
    confidence?: number;
}
export interface SerializedGraph {
    symbols: SerializedSymbol[];
    edges: SerializedEdge[];
    version: number;
    timestamp: number;
}
export declare function serializeSymbol(sym: Symbol): SerializedSymbol;
export declare function serializeEdge(edge: Edge): SerializedEdge;
export declare function serializeGraph(graph: RepoGraph): SerializedGraph;
export interface SerializedGraphV2 {
    version: 2;
    timestamp: number;
    symbols: SerializedSymbol[];
    edges: SerializedEdge[];
    fileSymbols: Record<string, string[]>;
    fileImports: Record<string, string[]>;
    fileCalls: Record<string, [string, number, string][]>;
    fileImportBindings: Record<string, JSImportBinding[]>;
    fileExports: Record<string, JSExportBinding[]>;
    fileMtimes: Record<string, number>;
}
export declare function serializeGraphV2(graph: RepoGraph, fileMtimes: Map<string, number>): SerializedGraphV2;
export declare function deserializeGraphV2(data: SerializedGraphV2): RepoGraph;
export interface GraphDiff {
    summary: {
        added: number;
        removed: number;
        modified: number;
        edgesAdded: number;
        edgesRemoved: number;
    };
    addedSymbols: {
        id: string;
        name: string;
        file: string;
        line: number;
    }[];
    removedSymbols: {
        id: string;
        name: string;
        file: string;
        line: number;
    }[];
    modifiedSymbols: ModifiedSymbol[];
    callChainChanges: {
        newCalls: {
            from: string;
            to: string;
            kind: string;
        }[];
        removedCalls: {
            from: string;
            to: string;
            kind: string;
        }[];
    };
}
export interface ModifiedSymbol {
    id: string;
    name: string;
    file: string;
    visibility: string;
    kind: string;
    lineChange: string;
    oldSignature: string;
    newSignature: string;
    signatureChanged: boolean;
    affectedCallers?: {
        symbolId: string;
        kind: string;
    }[];
    affectedCallerCount?: number;
    risk?: "HIGH" | "MEDIUM" | "LOW";
}
export declare function compareGraphSnapshots(currentSymbols: Symbol[], currentEdges: Edge[], previousSymbols: SerializedSymbol[], previousEdges: SerializedEdge[]): GraphDiff;
//# sourceMappingURL=graph.d.ts.map