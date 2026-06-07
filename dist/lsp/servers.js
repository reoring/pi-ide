/**
 * pi-ide lsp/servers — Language server configuration table.
 *
 * Ported from repomap/src/lsp.py (LSP_SPECS, language_for_file).
 * Only 6 languages: Python (pyright + pylsp), TypeScript, Go, JSON, YAML, Rust.
 */
// ── Server specs ─────────────────────────────────────────────────────────────
export const LSP_SERVER_SPECS = [
    // ── Python ──────────────────────────────────────────────────────────────
    {
        language: "python",
        serverName: "pyright-langserver",
        commandNames: ["pyright-langserver"],
        args: ["--stdio"],
        fileSuffixes: [".py", ".pyi", ".pyx", ".pxd"],
        rootMarkers: ["pyproject.toml", "setup.py", "setup.cfg", ".venv"],
        projectRelativeCandidates: [".venv/bin/pyright-langserver"],
    },
    {
        language: "python",
        serverName: "pylsp",
        commandNames: ["pylsp"],
        args: [],
        fileSuffixes: [".py", ".pyi", ".pyx", ".pxd"],
        rootMarkers: ["pyproject.toml", "setup.py", "setup.cfg", ".venv"],
        projectRelativeCandidates: [".venv/bin/pylsp"],
    },
    // ── TypeScript ──────────────────────────────────────────────────────────
    {
        language: "typescript",
        serverName: "typescript-language-server",
        commandNames: ["typescript-language-server"],
        args: ["--stdio"],
        fileSuffixes: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
        rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json"],
        projectRelativeCandidates: ["node_modules/.bin/typescript-language-server"],
    },
    // ── Go ────────────────────────────────────────────────────────────────────
    {
        language: "go",
        serverName: "gopls",
        commandNames: ["gopls"],
        args: [],
        fileSuffixes: [".go"],
        rootMarkers: ["go.mod", "go.work"],
    },
    // ── JSON ──────────────────────────────────────────────────────────────────
    {
        language: "json",
        serverName: "vscode-json-languageserver",
        commandNames: ["vscode-json-languageserver", "json-languageserver"],
        args: ["--stdio"],
        fileSuffixes: [".json", ".jsonc", ".json5"],
        rootMarkers: ["package.json", ".vscode"],
    },
    // ── YAML ──────────────────────────────────────────────────────────────────
    {
        language: "yaml",
        serverName: "yaml-language-server",
        commandNames: ["yaml-language-server"],
        args: ["--stdio"],
        fileSuffixes: [".yaml", ".yml"],
        rootMarkers: [".github", ".yaml", ".yml"],
    },
    // ── Rust ──────────────────────────────────────────────────────────────────
    {
        language: "rust",
        serverName: "rust-analyzer",
        commandNames: ["rust-analyzer"],
        args: [],
        fileSuffixes: [".rs"],
        rootMarkers: ["Cargo.toml"],
    },
];
// ── Suffix → language mapping ────────────────────────────────────────────────
/** File suffix → LSP language mapping, derived from LSP_SERVER_SPECS. */
export const suffixToLanguage = {};
for (const spec of LSP_SERVER_SPECS) {
    for (const suffix of spec.fileSuffixes) {
        if (!suffixToLanguage[suffix]) {
            suffixToLanguage[suffix] = spec.language;
        }
    }
}
// ── Lookup helpers ───────────────────────────────────────────────────────────
/**
 * Get the LSP language for a file based on its extension.
 */
export function languageForSuffix(suffix) {
    return suffixToLanguage[suffix.toLowerCase()];
}
/**
 * Get all server specs for a given language.
 */
export function specsForLanguage(language) {
    return LSP_SERVER_SPECS.filter((s) => s.language === language);
}
/**
 * Get all unique LSP languages from file suffixes.
 */
export function languagesForSuffixes(suffixes) {
    const langs = new Set();
    for (const suffix of suffixes) {
        const lang = languageForSuffix(suffix);
        if (lang)
            langs.add(lang);
    }
    return [...langs].sort();
}
// ── LSP timeouts by language ─────────────────────────────────────────────────
const LSP_TIMEOUT_BY_LANGUAGE = {
    typescript: 15_000,
    python: 12_000,
    rust: 20_000,
    go: 8_000,
    json: 8_000,
    yaml: 8_000,
};
export const DEFAULT_LSP_TIMEOUT_MS = 8_000;
/**
 * Get the recommended LSP timeout for a language (in milliseconds).
 */
export function lspTimeoutFor(language) {
    return LSP_TIMEOUT_BY_LANGUAGE[language] ?? DEFAULT_LSP_TIMEOUT_MS;
}
