/**
 * pi-shazam core/treesitter — Tree-sitter AST parsing + symbol extraction.
 *
 * Ported from repomap/src/parser.py (TreeSitterAdapter).
 *
 * Node.js tree-sitter (v0.22.4) API:
 * - Parser = require("tree-sitter") (default export is the Parser)
 * - Query = require("tree-sitter").Query (named export)
 * - parser.setLanguage(grammarModule) — pass grammar module directly
 * - query.captures(node) → {name: string, node: SyntaxNode}[]
 *
 * Grammar modules (tree-sitter-python etc.) export objects with
 * {name, language, nodeTypeInfo} — they are passed directly to
 * setLanguage() and Query constructor.
 */
import type { Symbol, JSImportBinding, JSExportBinding } from "./graph.js";
interface Tree {
    rootNode: SyntaxNode;
}
interface SyntaxNode {
    type: string;
    text: string;
    children: SyntaxNode[];
    parent: SyntaxNode | null;
    startPosition: {
        row: number;
        column: number;
    };
    endPosition: {
        row: number;
        column: number;
    };
    childForFieldName?(name: string): SyntaxNode | null;
}
export declare const EXT_TO_LANG: Record<string, string>;
export declare class TreeSitterAdapter {
    private parsers;
    private queries;
    private log;
    constructor(log?: (msg: string) => void);
    private _initParsers;
    private _loadGrammar;
    private _loadTypeScript;
    private _precompileQueries;
    hasLanguage(lang: string): boolean;
    static langForExtension(ext: string): string | undefined;
    parse(source: string, lang: string): Tree | null;
    extractSymbols(tree: Tree, lang: string, file: string): Symbol[];
    private _extractStandardSymbols;
    private _extractHtmlSymbols;
    private _extractCssSymbols;
    private _extractJsonSymbols;
    extractImports(tree: Tree, lang: string): [string, number][];
    extractCalls(tree: Tree, lang: string): [string, number, string][];
    extractJsTsImportBindings(tree: Tree, lang: string): JSImportBinding[];
    extractJsTsExportBindings(tree: Tree, lang: string): JSExportBinding[];
    private _walkTree;
    private _firstChildOfType;
    private _within;
    private _callRefKind;
    private _moduleLiteral;
    private _idText;
    private _lastIdent;
    private _signature;
}
export {};
//# sourceMappingURL=treesitter.d.ts.map