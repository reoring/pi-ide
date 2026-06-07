/**
 * pi-ide lsp/client — LSP protocol communication (JSON-RPC over stdio).
 *
 * Uses vscode-jsonrpc/node for wire protocol handling
 * (StreamMessageReader / StreamMessageWriter + createMessageConnection).
 *
 * Ported from repomap/src/lsp.py (StdioLspClient).
 */
import { spawn } from "node:child_process";
import * as path from "node:path";
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
// vscode-jsonrpc/node exports for LSP client over stdio
const rpc = _require("vscode-jsonrpc/node");
// ── Constants ────────────────────────────────────────────────────────────────
const MAX_LSP_FILE_SIZE = 1_048_576; // 1 MiB
// ── Helpers ──────────────────────────────────────────────────────────────────
function pathToUri(filePath) {
    const resolved = path.resolve(filePath);
    // file:// URI with absolute path
    const normalized = resolved.replace(/\\/g, "/");
    if (normalized[0] !== "/") {
        return `file:///${normalized}`;
    }
    return `file://${normalized}`;
}
export function uriToPath(uri) {
    if (uri.startsWith("file://")) {
        let p = uri.slice("file://".length);
        if (!p.startsWith("/")) {
            p = "/" + p;
        }
        try {
            return decodeURIComponent(p);
        }
        catch {
            return p;
        }
    }
    return uri;
}
function severityName(value) {
    if (value === 1)
        return "error";
    if (value === 2)
        return "warning";
    if (value === 3)
        return "info";
    if (value === 4)
        return "hint";
    return "warning";
}
function lspLanguageId(language, filePath) {
    const suffix = path.extname(filePath).toLowerCase();
    if (language === "typescript") {
        if (suffix === ".tsx")
            return "typescriptreact";
        if (suffix === ".jsx")
            return "javascriptreact";
        if ([".js", ".mjs", ".cjs"].includes(suffix))
            return "javascript";
        return "typescript";
    }
    return language;
}
// ── LspClient ────────────────────────────────────────────────────────────────
export class LspClient {
    command;
    workspaceRoot;
    timeout;
    process = null;
    connection = null;
    _openedFiles = new Set();
    _serverCapabilities = {};
    _running = false;
    _log;
    // Store notifications (e.g., diagnostics) received outside request-response
    _notifications = [];
    // Track in-flight LSP requests with their reject callbacks so close()
    // can cancel all pending requests.
    _inFlightRequests = new Map();
    constructor(command, workspaceRoot, timeout = 8000, log) {
        this.command = command;
        this.workspaceRoot = workspaceRoot;
        this.timeout = timeout;
        this._log = log ?? (() => { });
    }
    // ── State ──────────────────────────────────────────────────────────────────
    isRunning() {
        return this._running;
    }
    isFileOpened(filePath) {
        return this._openedFiles.has(path.resolve(filePath));
    }
    get serverCapabilities() {
        return this._serverCapabilities;
    }
    // ── Lifecycle ──────────────────────────────────────────────────────────────
    start() {
        if (this._running)
            return;
        this._log(`Starting LSP: ${this.command[0]} (workspace: ${this.workspaceRoot})`);
        const [cmd, ...args] = this.command;
        this.process = spawn(cmd, args, {
            cwd: this.workspaceRoot,
            stdio: ["pipe", "pipe", "pipe"],
        });
        this.process.on("error", (err) => {
            this._log(`LSP process error: ${err.message}`);
            this._running = false;
            this.connection = null;
            this._openedFiles.clear();
            this._notifications = [];
            this._serverCapabilities = {};
        });
        this.process.on("exit", (code, signal) => {
            this._log(`LSP process exited: code=${code}, signal=${signal}`);
            this._running = false;
            this.connection = null;
            this._openedFiles.clear();
            this._notifications = [];
            this._serverCapabilities = {};
        });
        // Drain stderr to prevent deadlock
        if (this.process.stderr) {
            this.process.stderr.on("data", (chunk) => {
                this._log(`LSP stderr: ${chunk.toString("utf-8", 0, Math.min(chunk.length, 500))}`);
            });
        }
        // Create JSON-RPC connection over stdio
        const reader = new rpc.StreamMessageReader(this.process.stdout);
        const writer = new rpc.StreamMessageWriter(this.process.stdin);
        this.connection = rpc.createMessageConnection(reader, writer);
        // Listen for notifications (diagnostics etc.)
        this.connection.onNotification("textDocument/publishDiagnostics", (params) => {
            this._notifications.push(params);
        });
        this.connection.listen();
        this._running = true;
    }
    async initialize() {
        if (!this.connection) {
            throw new Error("LSP client not started");
        }
        const initParams = {
            processId: process.pid,
            rootUri: pathToUri(this.workspaceRoot),
            capabilities: {
                textDocument: {
                    publishDiagnostics: {},
                    synchronization: {},
                    definition: {},
                    references: {},
                    hover: {},
                    documentSymbol: {
                        hierarchicalDocumentSymbolSupport: true,
                    },
                    foldingRange: {},
                    semanticTokens: {
                        requests: { full: true },
                        tokenTypes: [
                            "namespace",
                            "type",
                            "class",
                            "enum",
                            "interface",
                            "struct",
                            "typeParameter",
                            "parameter",
                            "variable",
                            "property",
                            "enumMember",
                            "event",
                            "function",
                            "method",
                            "macro",
                            "keyword",
                            "modifier",
                            "comment",
                            "string",
                            "number",
                            "regexp",
                            "operator",
                        ],
                        tokenModifiers: [
                            "declaration",
                            "definition",
                            "readonly",
                            "static",
                            "deprecated",
                            "abstract",
                            "async",
                            "modification",
                            "documentation",
                            "defaultLibrary",
                        ],
                        formats: ["relative"],
                    },
                },
                workspace: {
                    symbol: {},
                },
            },
            workspaceFolders: null,
        };
        const result = await this.connection.sendRequest("initialize", initParams);
        this._serverCapabilities = result.capabilities ?? {};
        await this.connection.sendNotification("initialized", {});
        this._log(`LSP initialized: ${this.command[0]}`);
    }
    async didOpen(filePath, text) {
        if (!this.connection) {
            throw new Error("LSP client not started");
        }
        // Skip large files
        const byteLength = Buffer.byteLength(text, "utf-8");
        if (byteLength > MAX_LSP_FILE_SIZE) {
            this._log(`Skipping LSP for large file ${filePath} (${byteLength} bytes)`);
            return;
        }
        const uri = pathToUri(filePath);
        const params = {
            textDocument: {
                uri,
                languageId: lspLanguageId(this._detectLanguage(filePath), filePath),
                version: 1,
                text,
            },
        };
        await this.connection.sendNotification("textDocument/didOpen", params);
        this._openedFiles.add(path.resolve(filePath));
    }
    async request(method, params) {
        if (!this.connection) {
            throw new Error("LSP client not started");
        }
        return this.connection.sendRequest(method, params);
    }
    // ── Protocol methods ───────────────────────────────────────────────────────
    async definition(filePath, line, character) {
        if (!this.isFileOpened(filePath))
            return null;
        const params = {
            textDocument: { uri: pathToUri(filePath) },
            position: { line, character },
        };
        try {
            const result = await this.withTimeout(this.connection.sendRequest("textDocument/definition", params));
            return result ?? null;
        }
        catch (err) {
            console.warn("[lsp] definition failed:", err);
            return null;
        }
    }
    async references(filePath, line, character) {
        if (!this.isFileOpened(filePath))
            return null;
        const params = {
            textDocument: { uri: pathToUri(filePath) },
            position: { line, character },
            context: { includeDeclaration: true },
        };
        try {
            const result = await this.withTimeout(this.connection.sendRequest("textDocument/references", params));
            return result ?? null;
        }
        catch (err) {
            console.warn("[lsp] references failed:", err);
            return null;
        }
    }
    async hover(filePath, line, character) {
        if (!this.isFileOpened(filePath))
            return null;
        const params = {
            textDocument: { uri: pathToUri(filePath) },
            position: { line, character },
        };
        try {
            const result = await this.withTimeout(this.connection.sendRequest("textDocument/hover", params));
            return result ?? null;
        }
        catch (err) {
            console.warn("[lsp] hover failed:", err);
            return null;
        }
    }
    async documentSymbols(filePath) {
        if (!this.isFileOpened(filePath))
            return null;
        const params = {
            textDocument: { uri: pathToUri(filePath) },
        };
        try {
            const result = await this.withTimeout(this.connection.sendRequest("textDocument/documentSymbol", params));
            return result ?? null;
        }
        catch (err) {
            console.warn("[lsp] documentSymbols failed:", err);
            return null;
        }
    }
    async workspaceSymbol(query) {
        if (!this.connection)
            return null;
        const cap = this._serverCapabilities;
        if (!cap || !cap.workspaceSymbolProvider) {
            return null;
        }
        const params = { query };
        try {
            const result = await this.withTimeout(this.connection.sendRequest("workspace/symbol", params));
            return result ?? null;
        }
        catch (err) {
            console.warn("[lsp] workspaceSymbol failed:", err);
            return null;
        }
    }
    async semanticTokens(filePath) {
        if (!this.isFileOpened(filePath))
            return null;
        const cap = this._serverCapabilities;
        const stProvider = cap?.semanticTokensProvider;
        if (!stProvider)
            return null;
        const params = {
            textDocument: { uri: pathToUri(filePath) },
        };
        try {
            const result = await this.withTimeout(this.connection.sendRequest("textDocument/semanticTokens/full", params));
            return result ?? null;
        }
        catch (err) {
            console.warn("[lsp] semanticTokens failed:", err);
            return null;
        }
    }
    async foldingRange(filePath) {
        if (!this.isFileOpened(filePath))
            return null;
        const cap = this._serverCapabilities;
        if (!cap || !cap.foldingRangeProvider) {
            return null;
        }
        const params = {
            textDocument: { uri: pathToUri(filePath) },
        };
        try {
            const result = await this.withTimeout(this.connection.sendRequest("textDocument/foldingRange", params));
            return result ?? null;
        }
        catch (err) {
            console.warn("[lsp] foldingRange failed:", err);
            return null;
        }
    }
    /**
     * Race a request against the configured per-request timeout.
     * Returns null (via rejection caught by caller) when timeout fires first.
     */
    withTimeout(promise) {
        return new Promise((resolve, reject) => {
            this._inFlightRequests.set(promise, reject);
            const timer = setTimeout(() => {
                this._inFlightRequests.delete(promise);
                void promise.catch(() => { });
                reject(new Error(`LSP request timed out after ${this.timeout}ms`));
            }, this.timeout);
            promise
                .then((v) => {
                this._inFlightRequests.delete(promise);
                clearTimeout(timer);
                resolve(v);
            })
                .catch((err) => {
                this._inFlightRequests.delete(promise);
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    // ── Diagnostics ────────────────────────────────────────────────────────────
    /**
     * Collect diagnostics for a set of file paths.
     * Checks accumulated notifications first, then polls briefly for more.
     */
    collectDiagnostics(filePaths) {
        const expectedUris = new Set(filePaths.filter((f) => this.isFileOpened(f)).map((f) => pathToUri(f)));
        if (expectedUris.size === 0)
            return [];
        const results = [];
        const remaining = [];
        for (const notif of this._notifications) {
            if (expectedUris.has(notif.uri)) {
                results.push(notif);
                expectedUris.delete(notif.uri);
            }
            else {
                remaining.push(notif);
            }
        }
        this._notifications = remaining;
        return results;
    }
    // ── Close ──────────────────────────────────────────────────────────────────
    async close() {
        if (!this.process)
            return;
        this._log(`Closing LSP: ${this.command[0]}`);
        // Capture process reference before nulling — the 2s kill timeout
        // needs it after this.process is set to null below.
        const proc = this.process;
        // 1. Clean shutdown handshake: await shutdown, then exit, then dispose.
        if (this.connection) {
            try {
                await this.connection.sendRequest("shutdown");
            }
            catch (err) {
                this._log(`LSP close: shutdown request failed: ${err}`);
            }
            try {
                await this.connection.sendNotification("exit");
            }
            catch (err) {
                this._log(`LSP close: exit notification failed: ${err}`);
            }
            this.connection.dispose();
        }
        // 2. Remove only our event listeners (not Node.js internal ones).
        if (proc) {
            proc.removeAllListeners("exit");
            proc.removeAllListeners("error");
            try {
                if (proc.stderr) {
                    proc.stderr.removeAllListeners("data");
                }
            }
            catch {
                // stderr may not be an EventEmitter (e.g., in tests).
            }
        }
        // 3. Kill the process if it hasn't exited after the shutdown handshake.
        if (proc && proc.exitCode === null) {
            proc.kill();
        }
        // 4. Cancel all in-flight LSP requests to prevent unhandled rejections.
        const closeError = new Error("connection closed");
        for (const [p, reject] of this._inFlightRequests) {
            void p.catch(() => { });
            reject(closeError);
        }
        this._inFlightRequests.clear();
        this._running = false;
        this.connection = null;
        this.process = null;
        this._openedFiles.clear();
        this._notifications = [];
        this._serverCapabilities = {};
    }
    // ── Internal ───────────────────────────────────────────────────────────────
    _detectLanguage(filePath) {
        // Simple extension-based detection for didOpen
        const ext = path.extname(filePath).toLowerCase();
        const map = {
            ".py": "python",
            ".pyi": "python",
            ".pyx": "python",
            ".pxd": "python",
            ".ts": "typescript",
            ".tsx": "typescriptreact",
            ".mts": "typescript",
            ".cts": "typescript",
            ".js": "javascript",
            ".jsx": "javascriptreact",
            ".mjs": "javascript",
            ".cjs": "javascript",
            ".go": "go",
            ".rs": "rust",
            ".json": "json",
            ".jsonc": "jsonc",
            ".json5": "json5",
            ".yaml": "yaml",
            ".yml": "yaml",
        };
        return map[ext] ?? "plaintext";
    }
}
export function convertDiagnostics(projectRoot, uri, rawDiagnostics) {
    const filePath = uriToPath(uri);
    const relFile = path.relative(projectRoot, filePath) || filePath;
    return rawDiagnostics.map((d) => ({
        file: relFile,
        line: d.range.start.line + 1, // LSP 0-based → 1-based
        col: d.range.start.character + 1,
        endLine: d.range.end.line + 1,
        endCol: d.range.end.character + 1,
        severity: severityName(d.severity),
        code: String(d.code ?? ""),
        message: d.message,
        source: d.source ?? "lsp",
    }));
}
export function convertLocation(projectRoot, loc) {
    const filePath = uriToPath(loc.uri);
    const relFile = path.relative(projectRoot, filePath) || filePath;
    return {
        file: relFile,
        line: loc.range.start.line + 1,
        col: loc.range.start.character + 1,
        endLine: loc.range.end.line + 1,
        endCol: loc.range.end.character + 1,
    };
}
