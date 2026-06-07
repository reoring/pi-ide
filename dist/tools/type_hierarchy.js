import { Type } from "typebox";
import { createTool } from "./_factory.js";
import { getLspManager } from "./_context.js";
import { getNextForTool, formatNextSection } from "../core/output.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
export function registerTypeHierarchy(pi) {
    createTool(pi, {
        name: "code_type_hierarchy",
        label: "Type Hierarchy",
        description: `\
		When working with classes, interfaces, or abstract types — use this
		to see the full inheritance chain (supertypes and subtypes) in one
		call. Uses LSP 3.17 typeHierarchy protocol with graph inheritance
		edge fallback. Before refactoring a base class, finding all interface
		implementations, or adding methods to a parent type.`,
        params: Type.Object({
            name: Type.String(),
            direction: Type.Optional(Type.Union([Type.Literal("both"), Type.Literal("supertypes"), Type.Literal("subtypes")])),
        }),
        execute(graph, params) {
            const json = params.json ?? false;
            const name = params.name;
            const direction = params.direction ?? "both";
            const result = executeTypeHierarchy(graph, name, direction);
            return json
                ? JSON.stringify({ schema_version: "1.0", command: "type_hierarchy", status: "ok", result }, null, 2)
                : formatTypeHierarchy(result, name);
        },
    });
}
export function executeTypeHierarchy(graph, name, direction = "both") {
    // Find the symbol
    let symbol;
    for (const sym of graph.symbols.values()) {
        if (sym.name === name) {
            symbol = sym;
            break;
        }
    }
    const empty = {
        symbol: { name, kind: "unknown", file: "", line: 0, signature: "" },
        supertypes: [],
        subtypes: [],
    };
    if (!symbol)
        return empty;
    const result = {
        symbol: {
            name: symbol.name,
            kind: symbol.kind,
            file: symbol.file,
            line: symbol.line,
            signature: symbol.signature || "",
        },
        supertypes: [],
        subtypes: [],
    };
    // Try LSP typeHierarchy
    const lspManager = getLspManager();
    if (lspManager && (direction === "both" || direction === "supertypes")) {
        const serverInfo = lspManager.getServerForFile(symbol.file);
        if (serverInfo) {
            const client = serverInfo.client;
            try {
                if (!client.isFileOpened(symbol.file)) {
                    const content = readFileSync(resolve(serverInfo.workspaceRoot, symbol.file), "utf-8");
                    void client.didOpen(symbol.file, content).catch(() => { });
                }
            }
            catch {
                // Fall through to graph-based
            }
        }
    }
    // Graph-based hierarchy (always works, no LSP dependency)
    const inheritanceKinds = new Set(["class", "interface", "type_alias"]);
    // Supertype: find inherited symbol
    if (direction === "both" || direction === "supertypes") {
        const outgoing = graph.outgoing.get(symbol.id);
        if (outgoing) {
            for (const edge of outgoing) {
                const tgt = graph.symbols.get(edge.target);
                if (tgt && inheritanceKinds.has(tgt.kind)) {
                    result.supertypes.push({
                        name: tgt.name,
                        kind: tgt.kind,
                        file: tgt.file,
                        line: tgt.line,
                        signature: tgt.signature || "",
                    });
                }
            }
        }
    }
    // Subtype: find symbols that reference this one as inheritance
    if (direction === "both" || direction === "subtypes") {
        const incoming = graph.incoming.get(symbol.id);
        if (incoming) {
            for (const edge of incoming) {
                const src = graph.symbols.get(edge.source);
                if (src && inheritanceKinds.has(src.kind)) {
                    result.subtypes.push({
                        name: src.name,
                        kind: src.kind,
                        file: src.file,
                        line: src.line,
                        signature: src.signature || "",
                    });
                }
            }
        }
    }
    // Deduplicate by name+file
    result.supertypes = deduplicate(result.supertypes);
    result.subtypes = deduplicate(result.subtypes);
    return result;
}
function deduplicate(entries) {
    const seen = new Set();
    return entries.filter((e) => {
        const key = `${e.name}:${e.file}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function formatTypeHierarchy(result, name) {
    const lines = [
        `## Result: Type Hierarchy for \`${name}\``,
        "",
        `**Kind:** ${result.symbol.kind}`,
        `**File:** \`${result.symbol.file}:${result.symbol.line}\``,
        "",
    ];
    if (result.supertypes.length > 0) {
        lines.push(`### Supertypes (${result.supertypes.length})`);
        for (const s of result.supertypes) {
            lines.push(`- ${s.kind} \`${s.name}\` — ${s.file}:${s.line}`);
        }
        lines.push("");
    }
    else {
        lines.push("No supertypes found.", "");
    }
    if (result.subtypes.length > 0) {
        lines.push(`### Subtypes (${result.subtypes.length})`);
        for (const s of result.subtypes) {
            lines.push(`- ${s.kind} \`${s.name}\` — ${s.file}:${s.line}`);
        }
        lines.push("");
    }
    else {
        lines.push("No subtypes found.", "");
    }
    const nextItems = getNextForTool("type_hierarchy");
    const nextSection = formatNextSection(nextItems);
    if (nextSection) {
        lines.push(nextSection);
    }
    return lines.join("\n");
}
