/**
 * pi-shazam lsp/manager — Language server process lifecycle management.
 *
 * Detects project languages, spawns LSP servers on demand,
 * handles health checks, restarts, and graceful shutdown.
 *
 * Ported from repomap/src/lsp.py (detect_project_languages, detect_lsp_server).
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { LspClient } from "./client.js";
import { LSP_SERVER_SPECS, languageForSuffix, lspTimeoutFor } from "./servers.js";
import { SKIP_DIRS } from "../core/filter.js";
// ── Project language detection ───────────────────────────────────────────────
/**
 * Check if a path contains any skip directory segment.
 * Used to avoid feeding vendored/generated files to LSP.
 */
export function shouldSkipPath(filePath) {
    const segments = filePath.split("/");
    for (const seg of segments) {
        if (SKIP_DIRS.has(seg))
            return true;
    }
    return false;
}
/**
 * Walk project root and detect languages from file extensions.
 */
export function detectProjectLanguages(projectRoot, maxFiles = 2000) {
    const langs = new Set();
    let seen = 0;
    function walk(dir) {
        if (seen >= maxFiles)
            return;
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (seen >= maxFiles)
                return;
            if (SKIP_DIRS.has(entry))
                continue;
            const fullPath = join(dir, entry);
            let st;
            try {
                st = statSync(fullPath);
            }
            catch {
                continue;
            }
            if (st.isDirectory()) {
                walk(fullPath);
            }
            else if (st.isFile()) {
                seen++;
                const ext = entry.substring(entry.lastIndexOf(".")).toLowerCase();
                const lang = languageForSuffix(ext);
                if (lang)
                    langs.add(lang);
            }
        }
    }
    walk(resolve(projectRoot));
    return [...langs].sort();
}
// ── LSP server detection ─────────────────────────────────────────────────────
/**
 * Find the LSP workspace root by walking up from a file path
 * looking for root markers.
 */
function detectWorkspaceRoot(projectRoot, filePath, language) {
    const root = resolve(projectRoot);
    const specs = LSP_SERVER_SPECS.filter((s) => s.language === language);
    const markers = new Set();
    for (const spec of specs) {
        for (const m of spec.rootMarkers) {
            markers.add(m);
        }
    }
    let current = filePath ? resolve(filePath) : root;
    if (!existsSync(current))
        current = root;
    // Start from file's directory
    if (existsSync(current) && statSync(current).isFile()) {
        current = join(current, "..");
    }
    current = resolve(current);
    while (true) {
        for (const marker of markers) {
            if (existsSync(join(current, marker))) {
                return current;
            }
        }
        // Check if we've reached or passed the project root
        const parent = resolve(current, "..");
        if (current === parent || current === "/" || parent === root) {
            if (current !== root) {
                // Check root itself
                for (const marker of markers) {
                    if (existsSync(join(root, marker))) {
                        return root;
                    }
                }
            }
            break;
        }
        current = parent;
    }
    return root;
}
// ── Executable search ────────────────────────────────────────────────────────
function isExecutable(filePath) {
    try {
        const st = statSync(filePath);
        // Check if file exists and is executable (or just exists on Windows)
        if (process.platform === "win32")
            return st.isFile();
        return st.isFile();
        // Note: actual X_OK check requires fs.accessSync which we skip for simplicity
        // The spawn() call will fail if it's not executable
    }
    catch {
        return false;
    }
}
function findInPath(command) {
    const pathEnv = process.env.PATH ?? "";
    const dirs = pathEnv.split(":");
    for (const dir of dirs) {
        const candidate = join(dir, command);
        if (isExecutable(candidate))
            return candidate;
    }
    return null;
}
function trustedUserCandidates(commandName) {
    const home = homedir();
    const candidates = [
        join(home, ".local", "bin", commandName),
        join(home, ".npm-global", "bin", commandName),
        join(home, ".cargo", "bin", commandName),
        join(home, "go", "bin", commandName),
        join(home, ".bun", "bin", commandName),
        join(home, ".yarn", "bin", commandName),
        join(home, ".config", "yarn", "global", "node_modules", ".bin", commandName),
        join(home, ".local", "share", "pnpm", commandName),
        join(home, ".local", "share", "nvim", "mason", "bin", commandName),
    ];
    return candidates.filter(isExecutable);
}
// ── Detection ────────────────────────────────────────────────────────────────
export function detectLspServer(projectRoot, language, filePath) {
    const root = resolve(projectRoot);
    const workspaceRoot = detectWorkspaceRoot(root, filePath ?? null, language);
    const specs = LSP_SERVER_SPECS.filter((s) => s.language === language);
    if (specs.length === 0) {
        return {
            language,
            serverName: "",
            status: "missing",
            command: [],
            source: "",
            workspaceRoot: root,
            reason: "unsupported language",
        };
    }
    for (const spec of specs) {
        // Check project-relative candidates first
        if (spec.projectRelativeCandidates) {
            for (const candidate of spec.projectRelativeCandidates) {
                const fullPath = join(workspaceRoot, candidate);
                if (isExecutable(fullPath)) {
                    return {
                        language,
                        serverName: spec.serverName,
                        status: "available",
                        command: [fullPath, ...spec.args],
                        source: "project",
                        workspaceRoot,
                    };
                }
            }
        }
        // Check PATH
        for (const cmdName of spec.commandNames) {
            const resolved = findInPath(cmdName);
            if (resolved) {
                return {
                    language,
                    serverName: spec.serverName,
                    status: "available",
                    command: [resolved, ...spec.args],
                    source: "path",
                    workspaceRoot,
                };
            }
            // Check user directories
            for (const candidate of trustedUserCandidates(cmdName)) {
                return {
                    language,
                    serverName: spec.serverName,
                    status: "available",
                    command: [candidate, ...spec.args],
                    source: "user",
                    workspaceRoot,
                };
            }
        }
    }
    return {
        language,
        serverName: specs[0].serverName,
        status: "missing",
        command: [],
        source: "",
        workspaceRoot,
        reason: "LSP server executable not found",
    };
}
// ── LspManager ───────────────────────────────────────────────────────────────
export class LspManager {
    projectRoot;
    servers = new Map();
    log;
    constructor(projectRoot, log) {
        this.projectRoot = resolve(projectRoot);
        this.log = log ?? (() => { });
    }
    // ── Detection ──────────────────────────────────────────────────────────────
    /**
     * Auto-detect languages in the project and return what was found.
     */
    detectLanguages() {
        return detectProjectLanguages(this.projectRoot);
    }
    /**
     * Detect LSP server for a specific language.
     */
    detectServer(language, filePath) {
        return detectLspServer(this.projectRoot, language, filePath ?? null);
    }
    // ── Server management ──────────────────────────────────────────────────────
    /**
     * Get the LSP client for a given file, creating one if needed.
     * Returns null if no LSP server is available for the file's language.
     */
    getServerForFile(filePath) {
        // Skip vendored / generated / cache directories
        if (shouldSkipPath(filePath))
            return null;
        const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
        const language = languageForSuffix(ext);
        if (!language)
            return null;
        return this.getServerForLanguage(language, filePath);
    }
    /**
     * Get or create an LSP client for a language.
     */
    getServerForLanguage(language, filePath) {
        // Return existing server if already running
        const existing = this.servers.get(language);
        if (existing && existing.client.isRunning())
            return existing;
        // Remove dead client so re-detection can happen
        if (existing) {
            this.servers.delete(language);
        }
        // Detect and spawn
        const detection = detectLspServer(this.projectRoot, language, filePath ?? null);
        if (detection.status !== "available" || detection.command.length === 0) {
            this.log(`LSP server not available for ${language}: ${detection.reason ?? "not found"}`);
            return null;
        }
        const timeout = lspTimeoutFor(language);
        const client = new LspClient(detection.command, detection.workspaceRoot, timeout, this.log);
        try {
            client.start();
        }
        catch (err) {
            this.log(`Failed to start LSP for ${language}: ${err}`);
            return null;
        }
        if (!client.isRunning()) {
            this.log(`LSP process for ${language} died immediately after start`);
            return null;
        }
        const info = {
            language,
            serverName: detection.serverName,
            client,
            command: detection.command,
            workspaceRoot: detection.workspaceRoot,
            source: detection.source,
        };
        this.servers.set(language, info);
        return info;
    }
    /**
     * Initialize all detected LSP servers.
     */
    async initializeAll() {
        const languages = this.detectLanguages();
        const promises = languages.map(async (language) => {
            const info = this.getServerForLanguage(language);
            if (info) {
                try {
                    await info.client.initialize();
                    this.log(`LSP initialized: ${language} (${info.serverName})`);
                }
                catch (err) {
                    this.log(`LSP init failed for ${language}: ${err}`);
                }
            }
        });
        await Promise.allSettled(promises);
    }
    /**
     * Get all active LSP servers.
     */
    getActiveServers() {
        return [...this.servers.values()];
    }
    /**
     * Shutdown all LSP servers gracefully.
     */
    async shutdown() {
        for (const [language, info] of this.servers) {
            try {
                await info.client.close();
                this.log(`LSP shutdown: ${language}`);
            }
            catch (err) {
                this.log(`LSP shutdown error for ${language}: ${err}`);
            }
        }
        this.servers.clear();
    }
}
//# sourceMappingURL=manager.js.map