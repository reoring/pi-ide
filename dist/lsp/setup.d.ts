/**
 * pi-ide lsp/setup — /code-setup command: detect + install guidance.
 *
 * Scans the project for supported languages, detects installed LSP servers,
 * and outputs install instructions for missing ones.
 *
 * Ported from repomap/src/lsp.py (detect_lsp_servers and CLI output formatting).
 */
import type { LspServerDetection } from "./manager.js";
export type { LspServerDetection };
/**
 * Detect LSP servers for specified languages or auto-detect from project.
 */
export declare function detectLspServers(projectRoot: string, languages?: string[]): LspServerDetection[];
/**
 * Generate the /code-setup output as a formatted string.
 */
export declare function generateSetupReport(projectRoot: string, languages?: string[]): string;
/**
 * Get the install instructions as a simple key-value map
 * for use in tool outputs.
 */
export declare function getInstallInstructions(): Record<string, string[]>;
