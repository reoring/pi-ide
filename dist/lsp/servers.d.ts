/**
 * pi-ide lsp/servers — Language server configuration table.
 *
 * Ported from repomap/src/lsp.py (LSP_SPECS, language_for_file).
 * Only 6 languages: Python (pyright + pylsp), TypeScript, Go, JSON, YAML, Rust.
 */
export interface LspServerSpec {
    /** Language identifier (e.g., "python", "typescript") */
    language: string;
    /** Human-readable server name */
    serverName: string;
    /** Executable names to search for (first found wins) */
    commandNames: readonly string[];
    /** Default CLI arguments */
    args: readonly string[];
    /** File extensions this server handles */
    fileSuffixes: readonly string[];
    /** Root marker files (e.g., package.json, Cargo.toml) */
    rootMarkers: readonly string[];
    /** Relative paths from workspace root to check for project-local installs */
    projectRelativeCandidates?: readonly string[];
}
export declare const LSP_SERVER_SPECS: readonly LspServerSpec[];
/** File suffix → LSP language mapping, derived from LSP_SERVER_SPECS. */
export declare const suffixToLanguage: Record<string, string>;
/**
 * Get the LSP language for a file based on its extension.
 */
export declare function languageForSuffix(suffix: string): string | undefined;
/**
 * Get all server specs for a given language.
 */
export declare function specsForLanguage(language: string): LspServerSpec[];
/**
 * Get all unique LSP languages from file suffixes.
 */
export declare function languagesForSuffixes(suffixes: string[]): string[];
export declare const DEFAULT_LSP_TIMEOUT_MS = 8000;
/**
 * Get the recommended LSP timeout for a language (in milliseconds).
 */
export declare function lspTimeoutFor(language: string): number;
//# sourceMappingURL=servers.d.ts.map