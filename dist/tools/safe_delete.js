import { Type } from "typebox";
import { getNextForTool, formatNextSection } from "../core/output.js";
import { createTool } from "./_factory.js";
export function registerSafeDelete(pi) {
    createTool(pi, {
        name: "shazam_safe_delete",
        label: "Safe Delete",
        description: `\
		Required safety gate before removing any symbol. Automatically
		verifies zero incoming references before providing deletion
		instructions. This is a WRITE operation. Safety workflow: checks
		incoming references (must be 0), reports outgoing references,
		provides deletion guidance. Do not delete based on intuition — a
		symbol that looks unused may be called dynamically.`,
        params: Type.Object({
            symbol: Type.String(),
            dryRun: Type.Optional(Type.Boolean()),
        }),
        execute(graph, params) {
            const json = params.json ?? false;
            const symbolName = params.symbol;
            const dryRun = params.dryRun ?? true;
            const result = executeSafeDelete(graph, symbolName, dryRun);
            return json
                ? JSON.stringify({ schema_version: "1.0", command: "safe_delete", status: "ok", result }, null, 2)
                : formatSafeDeleteResult(result, symbolName);
        },
    });
}
export function executeSafeDelete(graph, symbolName, dryRun = true) {
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
            incomingCount: 0,
            outgoingCount: 0,
            file: "",
            line: 0,
            kind: "unknown",
            dryRun,
            message: `Symbol "${symbolName}" not found in the project.`,
        };
    }
    const incoming = graph.incoming.get(symbol.id) || [];
    const outgoing = graph.outgoing.get(symbol.id) || [];
    if (incoming.length > 0) {
        return {
            status: "has_references",
            symbol: symbolName,
            incomingCount: incoming.length,
            outgoingCount: outgoing.length,
            file: symbol.file,
            line: symbol.line,
            kind: symbol.kind,
            dryRun,
            message: `Symbol "${symbolName}" still has ${incoming.length} incoming reference(s). Cannot safely delete. Use shazam_call_chain --symbol ${symbolName} to review.`,
        };
    }
    const filePath = symbol.file;
    const lineNum = symbol.line;
    return {
        status: "safe",
        symbol: symbolName,
        incomingCount: 0,
        outgoingCount: outgoing.length,
        file: filePath,
        line: lineNum,
        kind: symbol.kind,
        dryRun,
        message: `Symbol "${symbolName}" (${symbol.kind}) at ${filePath}:${lineNum} has zero incoming references. ${dryRun
            ? "DRY RUN: Pass dryRun=false to confirm deletion."
            : `DELETE: Run \`git rm\` or manually remove the symbol definition in ${filePath}.`}`,
    };
}
function formatSafeDeleteResult(result, symbolName) {
    const lines = [
        `## Safe Delete: \`${symbolName}\``,
        "",
        `**Status:** ${result.status}`,
        `**Location:** ${result.file}:${result.line}`,
        `**Kind:** ${result.kind}`,
        `**Incoming refs:** ${result.incomingCount}`,
        `**Outgoing refs:** ${result.outgoingCount}`,
        `**Dry run:** ${result.dryRun}`,
        "",
    ];
    lines.push(result.message, "");
    const nextItems = getNextForTool("safe_delete", { topSymbol: symbolName });
    const nextSection = formatNextSection(nextItems);
    if (nextSection) {
        lines.push(nextSection);
    }
    return lines.join("\n");
}
//# sourceMappingURL=safe_delete.js.map