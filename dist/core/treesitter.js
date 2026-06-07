/**
 * pi-ide core/treesitter — Tree-sitter AST parsing + symbol extraction.
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
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const _tsModule = _require("tree-sitter");
const _ParserCtor = _tsModule.default ?? _tsModule;
if (typeof _ParserCtor !== "function") {
    throw new Error("tree-sitter: expected constructor function, got " + typeof _ParserCtor);
}
const Parser = _ParserCtor;
const _QueryCtor = _tsModule.Query;
if (typeof _QueryCtor !== "function") {
    throw new Error("tree-sitter: Query is not a constructor, got " + typeof _QueryCtor);
}
const Query = _QueryCtor;
import { createSymbol } from "./graph.js";
import { QUERIES } from "./treesitter-queries.js";
// ── File extension → tree-sitter language mapping ────────────────────────────
export const EXT_TO_LANG = {
    ".py": "python",
    ".pyi": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".mts": "typescript",
    ".cts": "typescript",
    ".go": "go",
    ".rs": "rust",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".json": "json",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hh": "cpp",
    ".java": "java",
    ".cs": "c_sharp",
    ".rb": "ruby",
};
// ── Main adapter class ───────────────────────────────────────────────────────
export class TreeSitterAdapter {
    parsers = new Map();
    queries = new Map();
    log;
    constructor(log) {
        this.log = log ?? (() => { });
        this._initParsers();
    }
    // ── Initialization ─────────────────────────────────────────────────────────
    _initParsers() {
        const grammars = [
            ["python", "tree-sitter-python", "python"],
            ["javascript", "tree-sitter-javascript", "javascript"],
            ["go", "tree-sitter-go", "go"],
            ["rust", "tree-sitter-rust", "rust"],
            ["html", "tree-sitter-html", "html"],
            ["css", "tree-sitter-css", "css"],
            ["json", "tree-sitter-json", "json"],
            ["c", "tree-sitter-c", "c"],
            ["java", "tree-sitter-java", "java"],
            ["cpp", "tree-sitter-cpp", "cpp"],
            ["c_sharp", "tree-sitter-c-sharp", "c_sharp"],
            ["ruby", "tree-sitter-ruby", "ruby"],
        ];
        for (const [lang, _pkg, _prop] of grammars) {
            this._loadGrammar(lang, _pkg);
        }
        // TypeScript + TSX — special handling
        this._loadTypeScript();
        // Precompile queries
        this._precompileQueries();
    }
    _loadGrammar(lang, pkg) {
        try {
            const grammar = _require(pkg);
            const parser = new Parser();
            parser.setLanguage(grammar);
            this.parsers.set(lang, parser);
            this.log(`Parser loaded: ${lang}`);
        }
        catch (e) {
            this.log(`Parser unavailable [${lang}]: ${e}`);
        }
    }
    _loadTypeScript() {
        try {
            const tsMod = _require("tree-sitter-typescript");
            const tsGrammar = tsMod.typescript ?? tsMod;
            const tsParser = new Parser();
            tsParser.setLanguage(tsGrammar);
            this.parsers.set("typescript", tsParser);
            this.log("Parser loaded: typescript (dedicated)");
            try {
                const tsxGrammar = tsMod.tsx ?? tsMod;
                const tsxParser = new Parser();
                tsxParser.setLanguage(tsxGrammar);
                this.parsers.set("tsx", tsxParser);
                this.log("Parser loaded: tsx (dedicated)");
            }
            catch {
                this.log("TSX parser unavailable");
            }
        }
        catch {
            // Fall back to JavaScript parser for TypeScript
            const jsParser = this.parsers.get("javascript");
            if (jsParser) {
                this.parsers.set("typescript", jsParser);
                this.log("TypeScript parser unavailable, falling back to JavaScript parser");
            }
        }
    }
    _precompileQueries() {
        for (const [lang, patterns] of Object.entries(QUERIES)) {
            const parser = this.parsers.get(lang);
            if (!parser)
                continue;
            const langQueries = new Map();
            try {
                for (const [qtype, src] of Object.entries(patterns)) {
                    if (!src || src.trim().length === 0)
                        continue;
                    try {
                        // Query(language, source) — language from parser
                        const language = parser.getLanguage();
                        const q = new Query(language, src);
                        langQueries.set(qtype, q);
                    }
                    catch (e) {
                        this.log(`Query compile failed [${lang}/${qtype}]: ${e}`);
                    }
                }
            }
            catch {
                this.log(`Unable to create queries for ${lang}`);
            }
            this.queries.set(lang, langQueries);
        }
    }
    // ── Public API ─────────────────────────────────────────────────────────────
    hasLanguage(lang) {
        return this.parsers.has(lang);
    }
    static langForExtension(ext) {
        return EXT_TO_LANG[ext];
    }
    parse(source, lang) {
        const parser = this.parsers.get(lang);
        if (!parser)
            return null;
        const MAX_PARSE_SIZE = 10 * 1024 * 1024; // 10MB
        if (source.length > MAX_PARSE_SIZE) {
            this.log(`File too large for parsing (${source.length} chars > ${MAX_PARSE_SIZE}), skipping`);
            return null;
        }
        // Quick nesting depth check on first 256KB
        const scanStr = source.slice(0, 256 * 1024);
        const openCount = (scanStr.match(/\(/g) || []).length + (scanStr.match(/\{/g) || []).length + (scanStr.match(/\[/g) || []).length;
        const closeCount = (scanStr.match(/\)/g) || []).length + (scanStr.match(/\}/g) || []).length + (scanStr.match(/\]/g) || []).length;
        if (Math.abs(openCount - closeCount) > 100 || Math.max(openCount, closeCount) > 1000) {
            this.log(`Extreme nesting risk detected (${openCount} open, ${closeCount} close), skipping`);
            return null;
        }
        try {
            return parser.parse(source);
        }
        catch (e) {
            this.log(`Parse error [${lang}]: ${e}`);
            return null;
        }
    }
    extractSymbols(tree, lang, file) {
        if (lang === "html")
            return this._extractHtmlSymbols(tree, file);
        if (lang === "css")
            return this._extractCssSymbols(tree, file);
        if (lang === "json")
            return this._extractJsonSymbols(tree, file);
        return this._extractStandardSymbols(tree, lang, file);
    }
    // ── Standard symbol extraction (function/class via query) ──────────────────
    _extractStandardSymbols(tree, lang, file) {
        const symbolsById = new Map();
        const root = tree.rootNode;
        const langQueries = this.queries.get(lang);
        if (!langQueries)
            return [];
        for (const qtype of ["function", "class"]) {
            const query = langQueries.get(qtype);
            if (!query)
                continue;
            const captures = query.captures(root);
            const nameNodes = [];
            const defNodes = [];
            for (const { name: capName, node } of captures) {
                if (capName === "name") {
                    nameNodes.push(node);
                }
                else if (capName.includes("definition") || capName.includes("export")) {
                    defNodes.push([node, capName]);
                }
            }
            let namesProcessed = 0;
            for (const nameNode of nameNodes) {
                if (namesProcessed >= 5000)
                    break;
                namesProcessed++;
                const matchingDefs = [];
                for (const [defNode, defCap] of defNodes) {
                    if (this._within(nameNode, defNode)) {
                        matchingDefs.push([defNode, defCap]);
                        if (matchingDefs.length >= 5000)
                            break;
                    }
                }
                matchingDefs.sort((a, b) => {
                    const aSize = (a[0].endPosition.row - a[0].startPosition.row) * 10000 +
                        (a[0].endPosition.column - a[0].startPosition.column);
                    const bSize = (b[0].endPosition.row - b[0].startPosition.row) * 10000 +
                        (b[0].endPosition.column - b[0].startPosition.column);
                    return (aSize - bSize ||
                        a[0].startPosition.row - b[0].startPosition.row ||
                        a[0].startPosition.column - b[0].startPosition.column);
                });
                for (const [defNode, defCap] of matchingDefs) {
                    const kind = defCap.includes(".") ? defCap.split(".").pop() : defCap;
                    let vis = defCap.includes("export") ? "exported" : "public";
                    const name = nameNode.text;
                    if (!name)
                        break;
                    if (lang === "python" && name.startsWith("_") && !name.startsWith("__")) {
                        vis = "private";
                    }
                    const symId = `${file}::${name}::${nameNode.startPosition.row + 1}`;
                    const sym = createSymbol(symId, name, kind, file, nameNode.startPosition.row + 1, {
                        endLine: defNode.endPosition.row + 1,
                        col: nameNode.startPosition.column,
                        visibility: vis,
                        signature: this._signature(defNode),
                    });
                    symbolsById.set(symId, sym);
                    break;
                }
            }
        }
        return [...symbolsById.values()].sort((a, b) => {
            return (a.file.localeCompare(b.file) ||
                a.line - b.line ||
                a.endLine - b.endLine ||
                a.col - b.col ||
                a.name.localeCompare(b.name) ||
                a.kind.localeCompare(b.kind));
        });
    }
    // ── HTML / CSS / JSON symbol extraction ────────────────────────────────────
    _extractHtmlSymbols(tree, file) {
        const symbolsById = new Map();
        const seen = new Map();
        for (const node of this._walkTree(tree.rootNode)) {
            if (node.type !== "element")
                continue;
            const startTag = this._firstChildOfType(node, "start_tag");
            if (!startTag)
                continue;
            let tagName = "";
            for (const child of startTag.children) {
                if (child.type === "tag_name") {
                    tagName = child.text;
                    break;
                }
            }
            if (!tagName)
                continue;
            const line = node.startPosition.row + 1;
            const key = `<${tagName}>:${line}`;
            const count = (seen.get(key) || 0) + 1;
            seen.set(key, count);
            const visibleName = count > 1 ? `<${tagName}>#${count}` : `<${tagName}>`;
            const symId = `${file}::${visibleName}::${line}`;
            symbolsById.set(symId, createSymbol(symId, visibleName, "element", file, line, {
                endLine: node.endPosition.row + 1,
                col: node.startPosition.column,
                visibility: "public",
                signature: visibleName,
            }));
        }
        return [...symbolsById.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.name.localeCompare(b.name));
    }
    _extractCssSymbols(tree, file) {
        const symbolsById = new Map();
        const seen = new Map();
        const selTypes = ["class_selector", "id_selector", "tag_name", "nesting_selector"];
        for (const node of this._walkTree(tree.rootNode)) {
            if (!selTypes.includes(node.type))
                continue;
            const rawName = node.text.trim();
            if (!rawName)
                continue;
            const line = node.startPosition.row + 1;
            let kind = "selector";
            if (rawName.startsWith("."))
                kind = "class_selector";
            else if (rawName.startsWith("#"))
                kind = "id_selector";
            const key = `${rawName}:${line}`;
            const count = (seen.get(key) || 0) + 1;
            seen.set(key, count);
            const visibleName = count > 1 ? `${rawName}#${count}` : rawName;
            const symId = `${file}::${visibleName}::${line}`;
            symbolsById.set(symId, createSymbol(symId, visibleName, kind, file, line, {
                endLine: node.endPosition.row + 1,
                col: node.startPosition.column,
                visibility: "public",
                signature: rawName,
            }));
        }
        return [...symbolsById.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.name.localeCompare(b.name));
    }
    _extractJsonSymbols(tree, file) {
        const symbolsById = new Map();
        const seen = new Map();
        for (const node of this._walkTree(tree.rootNode)) {
            if (node.type !== "pair")
                continue;
            const keyNode = node.childForFieldName?.("key");
            if (!keyNode)
                continue;
            const keyName = keyNode.text.replace(/^['"]|['"]$/g, "");
            if (!keyName)
                continue;
            const line = node.startPosition.row + 1;
            const key = `${keyName}:${line}`;
            const count = (seen.get(key) || 0) + 1;
            seen.set(key, count);
            const visibleName = count > 1 ? `${keyName}#${count}` : keyName;
            const symId = `${file}::${visibleName}::${line}`;
            symbolsById.set(symId, createSymbol(symId, visibleName, "json_key", file, line, {
                endLine: node.endPosition.row + 1,
                col: node.startPosition.column,
                visibility: "public",
                signature: `"${keyName}"`,
            }));
        }
        return [...symbolsById.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.name.localeCompare(b.name));
    }
    // ── Import extraction ──────────────────────────────────────────────────────
    extractImports(tree, lang) {
        const langQueries = this.queries.get(lang);
        const query = langQueries?.get("import");
        if (!query)
            return [];
        const results = new Map();
        const captures = query.captures(tree.rootNode);
        for (const { name: capName, node } of captures) {
            const isJs = ["javascript", "typescript", "tsx"].includes(lang);
            if (isJs && capName !== "source")
                continue;
            const text = node.text.replace(/^['"]|['"]$/g, "");
            if (!text)
                continue;
            const line = node.startPosition.row + 1;
            const key = `${text}::${line}`;
            if (!results.has(key)) {
                results.set(key, line);
            }
        }
        return [...results.entries()]
            .map(([k, line]) => {
            const idx = k.lastIndexOf("::");
            return [k.slice(0, idx), line];
        })
            .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    }
    // ── Call extraction ────────────────────────────────────────────────────────
    extractCalls(tree, lang) {
        const langQueries = this.queries.get(lang);
        const query = langQueries?.get("call");
        if (!query)
            return [];
        const results = new Set();
        for (const { name: capName, node } of query.captures(tree.rootNode)) {
            if (capName !== "name")
                continue;
            const name = node.text;
            if (!name)
                continue;
            const kind = this._callRefKind(node);
            const line = node.startPosition.row + 1;
            results.add(`${name}::${line}::${kind}`);
        }
        return [...results]
            .map((s) => {
            const parts = s.split("::");
            return [parts[0], parseInt(parts[1], 10), parts[2]];
        })
            .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));
    }
    // ── JS/TS import/export binding extraction ─────────────────────────────────
    extractJsTsImportBindings(tree, lang) {
        if (!["javascript", "typescript", "tsx"].includes(lang))
            return [];
        const bindings = new Map();
        for (const node of tree.rootNode.children) {
            if (node.type !== "import_statement")
                continue;
            const module = this._moduleLiteral(node);
            if (!module)
                continue;
            const line = node.startPosition.row + 1;
            const clause = this._firstChildOfType(node, "import_clause");
            if (!clause)
                continue;
            for (const child of clause.children) {
                if (child.type === "identifier") {
                    const key = `d:${child.text}:${module}:${line}`;
                    bindings.set(key, {
                        localName: child.text,
                        importedName: "default",
                        module,
                        line,
                        kind: "default",
                    });
                }
                else if (child.type === "named_imports") {
                    for (const spec of child.children) {
                        if (spec.type !== "import_specifier")
                            continue;
                        const src = this._idText(spec.childForFieldName?.("name")) || "";
                        const alias = this._idText(spec.childForFieldName?.("alias")) || src;
                        if (src && alias) {
                            const key = `n:${alias}:${src}:${module}:${line}`;
                            bindings.set(key, {
                                localName: alias,
                                importedName: src,
                                module,
                                line,
                                kind: "named",
                            });
                        }
                    }
                }
                else if (child.type === "namespace_import") {
                    const name = this._lastIdent(child);
                    if (name) {
                        const key = `ns:${name}:*:${module}:${line}`;
                        bindings.set(key, {
                            localName: name,
                            importedName: "*",
                            module,
                            line,
                            kind: "namespace",
                        });
                    }
                }
            }
        }
        return [...bindings.values()].sort((a, b) => a.line - b.line ||
            a.module.localeCompare(b.module) ||
            a.localName.localeCompare(b.localName) ||
            a.importedName.localeCompare(b.importedName) ||
            a.kind.localeCompare(b.kind));
    }
    extractJsTsExportBindings(tree, lang) {
        if (!["javascript", "typescript", "tsx"].includes(lang))
            return [];
        const bindings = new Map();
        for (const node of tree.rootNode.children) {
            if (node.type !== "export_statement")
                continue;
            const line = node.startPosition.row + 1;
            const module = this._moduleLiteral(node);
            const clause = this._firstChildOfType(node, "export_clause");
            if (clause) {
                const kind = module ? "reexport" : "local";
                for (const spec of clause.children) {
                    if (spec.type !== "export_specifier")
                        continue;
                    const src = this._idText(spec.childForFieldName?.("name")) || "";
                    const alias = this._idText(spec.childForFieldName?.("alias")) || src;
                    if (src && alias) {
                        const key = `${alias}:${src}:${module || ""}:${line}`;
                        bindings.set(key, {
                            exportedName: alias,
                            sourceName: src,
                            module: module || null,
                            line,
                            kind,
                        });
                    }
                }
            }
        }
        return [...bindings.values()].sort((a, b) => a.line - b.line ||
            a.exportedName.localeCompare(b.exportedName) ||
            (a.sourceName || "").localeCompare(b.sourceName || "") ||
            (a.module || "").localeCompare(b.module || "") ||
            a.kind.localeCompare(b.kind));
    }
    // ── AST helpers ────────────────────────────────────────────────────────────
    _walkTree(root, maxNodes = 500_000) {
        const nodes = [root];
        const result = [];
        while (nodes.length > 0 && result.length < maxNodes) {
            const cur = nodes.pop();
            result.push(cur);
            for (let i = cur.children.length - 1; i >= 0; i--) {
                nodes.push(cur.children[i]);
            }
        }
        return result;
    }
    _firstChildOfType(node, nodeType) {
        for (const child of node.children) {
            if (child.type === nodeType)
                return child;
        }
        return null;
    }
    _within(inner, outer) {
        // Compare positions as (row, column) pairs with proper lexicographic ordering.
        // A position (r1, c1) is <= (r2, c2) iff r1 < r2 or (r1 === r2 and c1 <= c2).
        const startOk = inner.startPosition.row > outer.startPosition.row ||
            (inner.startPosition.row === outer.startPosition.row && inner.startPosition.column >= outer.startPosition.column);
        const endOk = inner.endPosition.row < outer.endPosition.row ||
            (inner.endPosition.row === outer.endPosition.row && inner.endPosition.column <= outer.endPosition.column);
        return startOk && endOk;
    }
    _callRefKind(node) {
        let parent = node.parent;
        while (parent) {
            if (parent.type === "call_expression" || parent.type === "call") {
                const fn = parent.childForFieldName?.("function");
                if (fn && ["member_expression", "field_expression", "selector_expression", "attribute"].includes(fn.type)) {
                    return "member";
                }
                return "direct";
            }
            parent = parent.parent;
        }
        return "direct";
    }
    // ── Text helpers ───────────────────────────────────────────────────────────
    _moduleLiteral(node) {
        for (const child of node.children) {
            if (child.type === "string" || child.type === "string_fragment") {
                return child.text.replace(/^['"`]|['"`]$/g, "");
            }
        }
        return null;
    }
    _idText(node) {
        if (!node)
            return null;
        if (["identifier", "property_identifier", "type_identifier", "shorthand_property_identifier"].includes(node.type)) {
            return node.text;
        }
        return null;
    }
    _lastIdent(node) {
        const ids = node.children
            .filter((c) => ["identifier", "property_identifier", "type_identifier"].includes(c.type))
            .map((c) => c.text);
        return ids.length > 0 ? ids[ids.length - 1] : null;
    }
    _signature(node) {
        const text = node.text;
        const firstLine = text.split("\n")[0] || "";
        return firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine;
    }
}
//# sourceMappingURL=treesitter.js.map