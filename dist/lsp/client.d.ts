/**
 * pi-shazam lsp/client — LSP protocol communication (JSON-RPC over stdio).
 *
 * Uses vscode-jsonrpc/node for wire protocol handling
 * (StreamMessageReader / StreamMessageWriter + createMessageConnection).
 *
 * Ported from repomap/src/lsp.py (StdioLspClient).
 */
import type { Location, PublishDiagnosticsParams, Hover, SymbolInformation, DocumentSymbol, WorkspaceSymbol, SemanticTokens, FoldingRange } from "vscode-languageserver-protocol";
export interface LspDiagnostic {
    file: string;
    line: number;
    col: number;
    endLine: number;
    endCol: number;
    severity: "error" | "warning" | "info" | "hint";
    code: string;
    message: string;
    source: string;
}
export interface LspLocation {
    file: string;
    line: number;
    col: number;
    endLine: number;
    endCol: number;
}
export declare function uriToPath(uri: string): string;
export declare class LspClient {
    readonly command: readonly string[];
    readonly workspaceRoot: string;
    readonly timeout: number;
    private process;
    private connection;
    private _openedFiles;
    private _serverCapabilities;
    private _running;
    private _log;
    private _notifications;
    private _inFlightRequests;
    constructor(command: readonly string[], workspaceRoot: string, timeout?: number, log?: (msg: string) => void);
    isRunning(): boolean;
    isFileOpened(filePath: string): boolean;
    get serverCapabilities(): Record<string, unknown>;
    start(): void;
    initialize(): Promise<void>;
    didOpen(filePath: string, text: string): Promise<void>;
    request(method: string, params: unknown): Promise<unknown>;
    definition(filePath: string, line: number, character: number): Promise<Location | Location[] | null>;
    references(filePath: string, line: number, character: number): Promise<Location[] | null>;
    hover(filePath: string, line: number, character: number): Promise<Hover | null>;
    documentSymbols(filePath: string): Promise<DocumentSymbol[] | SymbolInformation[] | null>;
    workspaceSymbol(query: string): Promise<SymbolInformation[] | WorkspaceSymbol[] | null>;
    semanticTokens(filePath: string): Promise<SemanticTokens | null>;
    foldingRange(filePath: string): Promise<FoldingRange[] | null>;
    /**
     * Race a request against the configured per-request timeout.
     * Returns null (via rejection caught by caller) when timeout fires first.
     */
    private withTimeout;
    /**
     * Collect diagnostics for a set of file paths.
     * Checks accumulated notifications first, then polls briefly for more.
     */
    collectDiagnostics(filePaths: string[]): PublishDiagnosticsParams[];
    close(): Promise<void>;
    private _detectLanguage;
}
export interface RawLspDiagnostic {
    range: {
        start: {
            line: number;
            character: number;
        };
        end: {
            line: number;
            character: number;
        };
    };
    severity?: number;
    code?: string | number;
    message: string;
    source?: string;
}
export declare function convertDiagnostics(projectRoot: string, uri: string, rawDiagnostics: RawLspDiagnostic[]): LspDiagnostic[];
export declare function convertLocation(projectRoot: string, loc: Location): LspLocation;
//# sourceMappingURL=client.d.ts.map