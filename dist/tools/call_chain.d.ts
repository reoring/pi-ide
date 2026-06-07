/**
 * code tools/call_chain — Call graph traversal.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerCallChain(pi: ExtensionAPI): void;
export declare function executeCallChain(graph: RepoGraph, symbolName: string, depth?: number): string;
export declare function executeCallChainJson(graph: RepoGraph, symbolName: string, depth: number): string;
interface FlatReference {
    symbol: string;
    file: string;
    line: number;
    kind: string;
    direction: string;
}
export declare function getFlatReferences(graph: RepoGraph, symbolName: string): FlatReference[];
export declare function formatFlatReferences(refs: FlatReference[], symbolName: string): string;
export {};
