/**
 * pi-ide core/filter — Shared file filtering utilities.
 *
 * Centralises the "is this a source file?" logic used by hotspots, orphan,
 * verify, overview, and check tools. Keeps filtering consistent across the
 * codebase and avoids pattern duplication.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
/**
 * Config files, generated files, and lockfiles — excluded from source-file
 * analysis (hotspots, orphan detection, overview, check).
 *
 * The list is deliberately narrow: it covers *non-source* files that
 * tree-sitter would still parse (JSON, lockfiles) and inflate symbol counts.
 *
 * @returns true if the file path matches a known non-source pattern.
 */
const NON_SOURCE_FILE_PATTERNS = [
    "package-lock.json",
    "package.json",
    "tsconfig.json",
    "node_modules/",
    "dist/",
    ".json",
];
/**
 * Directories to skip during project scanning and LSP detection.
 *
 * Single source of truth -- consumed by core/scanner.ts and lsp/manager.ts.
 * Includes build outputs, dependency caches, virtual environments, IDE
 * directories, and other non-source trees that should never be walked.
 */
const DEFAULT_SKIP_DIRS = [
    "node_modules",
    "bower_components",
    "vendor",
    "dist",
    "build",
    "out",
    "target",
    ".git",
    ".cache",
    ".worktrees",
    ".pi-ide",
    ".qoder",
    "__pycache__",
    "coverage",
    ".nyc_output",
    "tmp",
    "temp",
    ".venv",
    "venv",
    ".tox",
    ".next",
    ".nuxt",
    ".turbo",
    ".vercel",
    ".yarn",
    ".idea",
    ".vscode",
    ".tmp",
    "refs",
    "wip",
    ".archives",
    ".meta",
    "sessions",
    "report",
    "reports",
    "logs",
    ".playwright-mcp",
    ".devbox",
    ".direnv",
    ".terraform",
    "vendor-cache",
    "test-results",
    "playwright-report",
];
function parseList(value) {
    return value
        ?.split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean) ?? [];
}
function readJsonConfig() {
    try {
        const candidates = [join(process.cwd(), ".pi-ide.json")];
        for (const file of candidates) {
            if (!existsSync(file))
                continue;
            const data = JSON.parse(readFileSync(file, "utf-8"));
            return Array.isArray(data?.skipDirs) ? data.skipDirs.filter((v) => typeof v === "string") : [];
        }
    }
    catch {
        return [];
    }
    return [];
}
export const SKIP_DIRS = new Set([
    ...DEFAULT_SKIP_DIRS,
    ...parseList(process.env.PI_IDE_SKIP_DIRS),
    ...readJsonConfig(),
]);
export function isNonSourceFile(file) {
    return NON_SOURCE_FILE_PATTERNS.some((p) => file.includes(p));
}
//# sourceMappingURL=filter.js.map
