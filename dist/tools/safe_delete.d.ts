/**
 * code tools/safe_delete — Safe symbol/file deletion with call_chain verification.
 *
 * Confirms zero references via call_chain before allowing deletion.
 * Read-only safety check; it does not modify files on disk.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerSafeDelete(pi: ExtensionAPI): void;
interface SafeDeleteResult {
    status: "safe" | "has_references" | "not_found" | "error";
    symbol: string;
    incomingCount: number;
    outgoingCount: number;
    file: string;
    line: number;
    kind: string;
    dryRun: boolean;
    message: string;
}
export declare function executeSafeDelete(graph: RepoGraph, symbolName: string, dryRun?: boolean): SafeDeleteResult;
export {};
