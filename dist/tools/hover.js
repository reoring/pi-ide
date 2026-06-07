import { Type } from "typebox";
import { getLspManager } from "./_context.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getNextForTool, formatNextSection } from "../core/output.js";
import { createTool } from "./_factory.js";
export function registerHover(pi) {
    createTool(pi, {
        name: "shazam_hover",
        label: "Symbol Hover Info",
        description: `\
		After finding a symbol with shazam_symbol, use this to get its full
		type signature, documentation comments, and JSDoc — content that raw
		file reads miss. Connects to LSP hover providers for rich type info.
		Falls back to graph metadata when LSP is unavailable.`,
        params: Type.Object({
            name: Type.String(),
            file: Type.Optional(Type.String()),
        }),
        async execute(graph, params) {
            const json = params.json ?? false;
            const name = params.name;
            const file = params.file;
            const result = await executeHover(graph, name, file);
            return json
                ? JSON.stringify({ schema_version: "1.0", command: "hover", status: "ok", result }, null, 2)
                : formatHoverResult(result, name);
        },
    });
}
export async function executeHover(graph, name, file) {
    // Find the symbol in the graph
    let symbol;
    if (file) {
        const symIds = graph.fileSymbols.get(file);
        if (symIds) {
            for (const id of symIds) {
                const sym = graph.symbols.get(id);
                if (sym && sym.name === name) {
                    symbol = sym;
                    break;
                }
            }
        }
    }
    if (!symbol) {
        for (const sym of graph.symbols.values()) {
            if (sym.name === name) {
                symbol = sym;
                break;
            }
        }
    }
    if (!symbol) {
        return {
            name,
            file: "",
            line: 0,
            kind: "unknown",
            signature: "",
            pagerank: 0,
        };
    }
    const result = {
        name: symbol.name,
        file: symbol.file,
        line: symbol.line,
        kind: symbol.kind,
        signature: symbol.signature || "",
        pagerank: symbol.pagerank,
    };
    // Try LSP hover
    const lspManager = getLspManager();
    if (lspManager) {
        const serverInfo = lspManager.getServerForFile(symbol.file);
        if (serverInfo) {
            const client = serverInfo.client;
            try {
                if (!client.isFileOpened(symbol.file)) {
                    const content = readFileSync(resolve(serverInfo.workspaceRoot, symbol.file), "utf-8");
                    await client.didOpen(symbol.file, content);
                }
                const hoverData = await client.hover(symbol.file, symbol.line - 1, 0);
                if (hoverData?.contents) {
                    const contents = hoverData.contents;
                    if (typeof contents === "string") {
                        result.lspHover = contents;
                    }
                    else if (Array.isArray(contents)) {
                        result.lspHover = contents
                            .map((c) => {
                            if (typeof c === "string")
                                return c;
                            if (c && typeof c === "object" && "value" in c) {
                                return String(c.value);
                            }
                            return String(c);
                        })
                            .join("\n\n");
                    }
                    else if (contents && typeof contents === "object" && "value" in contents) {
                        result.lspHover = String(contents.value);
                    }
                    else {
                        result.lspHover = String(contents);
                    }
                }
            }
            catch {
                // LSP hover failed — fall back to graph metadata
            }
        }
    }
    return result;
}
function formatHoverResult(result, name) {
    const lines = [`## Hover: \`${name}\``, ""];
    if (!result.file) {
        lines.push(`Symbol "${name}" not found in the project.`);
        // Add Next recommendations
        const nextItems = getNextForTool("hover", { topSymbol: result.name });
        if (nextItems.length > 0) {
            lines.push("");
            lines.push(formatNextSection(nextItems));
        }
        return lines.join("\n");
    }
    lines.push(`**Kind:** ${result.kind}`);
    lines.push(`**File:** \`${result.file}:${result.line}\``);
    lines.push(`**PageRank:** ${result.pagerank.toFixed(4)}`);
    lines.push("");
    if (result.signature) {
        lines.push("### Signature");
        lines.push("");
        lines.push(`\`${result.signature}\``);
        lines.push("");
    }
    if (result.lspHover) {
        lines.push("### LSP Hover Info");
        lines.push("");
        lines.push(result.lspHover);
    }
    else {
        lines.push("*No LSP hover info available.*");
        lines.push("");
        lines.push('Run with diagnostics="lsp" in shazam_check to ensure LSP servers are initialized.');
    }
    return lines.join("\n");
}
//# sourceMappingURL=hover.js.map