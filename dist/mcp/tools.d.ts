/**
 * pi-shazam MCP tools — register all analysis tools as MCP tools.
 * Each handler is wrapped with withLogging() for usage analytics.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerAllTools(server: McpServer, graph: RepoGraph, projectRoot: string): void;
//# sourceMappingURL=tools.d.ts.map