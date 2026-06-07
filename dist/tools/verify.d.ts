/**
 * code tools/verify — Unified post-edit verification gate.
 *
 * Merges verify, check, and ready into one tool:
 *   1. LSP diagnostics (CORE) — type errors, warnings from language servers
 *   2. Graph analysis (SUPPLEMENTARY) — git diff, risk, orphans, graph diff
 *   3. Summary verdict — PASS / WARN / FAIL
 *
 * Supports modes:
 *   - default: full LSP + graph analysis
 *   - quick:    git changes + risk only (~2s)
 *   - lspOnly:  LSP diagnostics only, skip graph analysis
 *   - preCommit: stricter thresholds for pre-commit gate
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerVerify(pi: ExtensionAPI): void;
export interface VerifyOptions {
    quick?: boolean;
    lspOnly?: boolean;
    preCommit?: boolean;
    maxFiles?: number;
    noCascade?: boolean;
    noSecrets?: boolean;
}
export declare function executeVerifyJsonAsync(projectRoot: string, options: VerifyOptions): Promise<Record<string, unknown>>;
export declare function executeVerifyTextAsync(projectRoot: string, options: VerifyOptions): Promise<string>;
/**
 * Synchronous verify (no LSP, graph-only).
 */
export declare function executeVerify(graph: RepoGraph, _projectRoot: string, options?: VerifyOptions): string;
export declare function executeVerifyJson(graph: RepoGraph, projectRoot: string, options?: VerifyOptions): string;
/**
 * Synchronous tree-sitter parse diagnostics (from check.ts).
 */
export declare function executeCheck(graph: RepoGraph, _projectRoot: string, file?: string): string;
export declare function executeCheckJson(graph: RepoGraph, _projectRoot: string, file?: string): string;
export declare function executeReady(graph: RepoGraph, projectRoot: string): string;
export declare function executeReadyJson(graph: RepoGraph, projectRoot: string): string;
