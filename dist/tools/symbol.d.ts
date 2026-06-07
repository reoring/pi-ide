/**
 * code tools/symbol — Symbol lookup with optional LSP enrichment.
 *
 * Supports two modes:
 *   - default: standard symbol lookup with definition, kind, signature, callers, callees
 *   - state:   state map analysis for enum/class/interface/type_alias/const symbols
 *              (absorbed from tools/state_map.ts)
 *
 * When LSP documentSymbols are available for the symbol's file, the
 * output is annotated with container (parent symbol) and accurate
 * endLine from LSP range. Falls back to graph data when LSP unavailable.
 * State mode bypasses LSP enrichment and uses graph-only analysis.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerSymbol(pi: ExtensionAPI): void;
/**
 * Backward-compatible synchronous symbol lookup (no LSP enrichment).
 * Used by tests and callers that need a string result without awaiting.
 */
export declare function executeSymbol(graph: RepoGraph, name: string, file?: string): string;
/**
 * Backward-compatible symbol lookup with mode support.
 * When mode is "state", returns state map output.
 */
export declare function executeSymbolWithMode(graph: RepoGraph, name: string, mode?: string, file?: string): string;
/**
 * Backward-compatible JSON output (no LSP enrichment).
 */
export declare function executeSymbolJson(graph: RepoGraph, name: string, file?: string): string;
/**
 * Execute state map analysis for a given symbol name.
 * Filters to STATE_MAP_KINDS and shows members, usage, and dependencies.
 */
export declare function executeStateMap(graph: RepoGraph, symbolName: string): string;
