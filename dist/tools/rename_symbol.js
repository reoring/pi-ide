import { Type } from "typebox";
import { getNextForTool, formatNextSection } from "../core/output.js";
import { createTool } from "./_factory.js";
export function registerRenameSymbol(pi) {
    createTool(pi, {
        name: "code_rename_symbol",
        label: "Rename Symbol",
        description: `\
		Required safety gate before renaming any symbol. Step 1: call
		code_call_chain to review all references. Step 2: use this to
		perform the project-wide rename via LSP textDocument/rename. Step 3:
		call code_verify to confirm no broken references. This is a WRITE
		operation — do not manually find-and-replace; missed references
		become bugs.`,
        params: Type.Object({
            symbol: Type.String(),
            newName: Type.String(),
        }),
        execute(graph, params) {
            const json = params.json ?? false;
            const symbolName = params.symbol;
            const newName = params.newName;
            const result = executeRenameSymbol(graph, symbolName, newName);
            return json
                ? JSON.stringify({ schema_version: "1.0", command: "rename_symbol", status: "ok", result }, null, 2)
                : formatRenameResult(result, symbolName, newName);
        },
    });
}
export function executeRenameSymbol(graph, symbolName, newName) {
    // Find the symbol
    let symbol;
    for (const sym of graph.symbols.values()) {
        if (sym.name === symbolName) {
            symbol = sym;
            break;
        }
    }
    if (!symbol) {
        return {
            status: "not_found",
            symbol: symbolName,
            newName,
            message: `Symbol "${symbolName}" not found in the project.`,
        };
    }
    // Count references to estimate impact
    const incoming = graph.incoming.get(symbol.id) || [];
    const outgoing = graph.outgoing.get(symbol.id) || [];
    const totalRefs = incoming.length + outgoing.length;
    // Group by file
    const files = new Set();
    for (const edge of [...incoming, ...outgoing]) {
        const refSym = graph.symbols.get(edge.source) || graph.symbols.get(edge.target);
        if (refSym)
            files.add(refSym.file);
    }
    return {
        status: "ok",
        symbol: symbolName,
        newName,
        message: `Found ${totalRefs} references across ${files.size} files affecting "${symbolName}".`,
        fileCount: files.size,
        changes: totalRefs,
    };
}
function formatRenameResult(result, symbolName, newName) {
    const lines = [
        `## Rename Result: \`${symbolName}\` → \`${newName}\``,
        "",
        `**Status:** ${result.status}`,
        `**Message:** ${result.message}`,
    ];
    if (result.status === "ok" && result.fileCount !== undefined) {
        lines.push("", "### Impact Summary", "", `Files affected: ${result.fileCount}`, `Reference changes: ${result.changes}`);
    }
    const nextItems = getNextForTool("rename_symbol", { topSymbol: symbolName });
    const nextSection = formatNextSection(nextItems);
    if (nextSection) {
        lines.push("", nextSection);
    }
    return lines.join("\n");
}
//# sourceMappingURL=rename_symbol.js.map