/**
 * pi-shazam lsp/manager — Language server process lifecycle management.
 *
 * Detects project languages, spawns LSP servers on demand,
 * handles health checks, restarts, and graceful shutdown.
 *
 * Ported from repomap/src/lsp.py (detect_project_languages, detect_lsp_server).
 */
import { LspClient } from "./client.js";
import type { LspDiagnostic, LspLocation } from "./client.js";
export interface LspServerInfo {
    language: string;
    serverName: string;
    client: LspClient;
    command: readonly string[];
    workspaceRoot: string;
    source: "project" | "path" | "user";
}
export interface LspServerDetection {
    language: string;
    serverName: string;
    status: "available" | "missing";
    command: string[];
    source: string;
    workspaceRoot: string;
    reason?: string;
}
export interface LspRunResult {
    server: string;
    language: string;
    status: "ok" | "skipped" | "timeout" | "failed";
    diagnostics: LspDiagnostic[];
    definitions: LspLocation[];
    references: LspLocation[];
    command: string[];
    workspaceRoot: string;
    reason?: string;
    durationMs: number;
}
/**
 * Check if a path contains any skip directory segment.
 * Used to avoid feeding vendored/generated files to LSP.
 */
export declare function shouldSkipPath(filePath: string): boolean;
/**
 * Walk project root and detect languages from file extensions.
 */
export declare function detectProjectLanguages(projectRoot: string, maxFiles?: number): string[];
export declare function detectLspServer(projectRoot: string, language: string, filePath?: string | null): LspServerDetection;
export declare class LspManager {
    private projectRoot;
    private servers;
    private log;
    constructor(projectRoot: string, log?: (msg: string) => void);
    /**
     * Auto-detect languages in the project and return what was found.
     */
    detectLanguages(): string[];
    /**
     * Detect LSP server for a specific language.
     */
    detectServer(language: string, filePath?: string): LspServerDetection;
    /**
     * Get the LSP client for a given file, creating one if needed.
     * Returns null if no LSP server is available for the file's language.
     */
    getServerForFile(filePath: string): LspServerInfo | null;
    /**
     * Get or create an LSP client for a language.
     */
    getServerForLanguage(language: string, filePath?: string): LspServerInfo | null;
    /**
     * Initialize all detected LSP servers.
     */
    initializeAll(): Promise<void>;
    /**
     * Get all active LSP servers.
     */
    getActiveServers(): LspServerInfo[];
    /**
     * Shutdown all LSP servers gracefully.
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map