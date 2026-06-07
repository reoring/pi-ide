#!/usr/bin/env node
/**
 * pi-ide MCP server — exposes codebase analysis tools via Model Context Protocol.
 *
 * Usage: npx pi-ide-mcp
 *
 * Clients (Cursor, Claude Desktop, Windsurf, Qoder) launch this process
 * and communicate via stdio JSON-RPC.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { scanProject } from "../core/scanner.js";
import { registerAllTools } from "./tools.js";
const PROJECT_ROOT = process.argv[2] || ".";
async function main() {
    const server = new McpServer({
        name: "pi-ide",
        version: "0.1.0",
    });
    // Defer project scanning until a graph-backed tool is actually called.
    const getGraph = () => scanProject(PROJECT_ROOT);
    registerAllTools(server, getGraph, PROJECT_ROOT);
    // Start stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("pi-ide MCP server failed to start:", err);
    process.exit(1);
});
