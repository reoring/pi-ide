/**
 * code tools/_factory — Tool registration factory.
 *
 * Eliminates per-tool boilerplate by centralizing:
 * - json/maxTokens parameter defaults (merged with tool-specific params)
 * - scanProject(".") graph creation
 * - JSON/text output toggle with standard envelope
 * - maxTokens truncation
 * - AgentToolResult content envelope wrapping
 *
 * Tools with simple domain logic use the `execute` callback (receives graph + params).
 * Tools with complex custom logic (async LSP, multi-branch) use `customExecute`
 * which bypasses auto-scan and envelope wrapping but still gets merged params.
 */
import type { ExtensionAPI, AgentToolResult, AgentToolUpdateCallback, ExtensionContext } from "../types/pi-extension.js";
import { type TProperties, type TObject } from "typebox";
import type { RepoGraph } from "../core/graph.js";
export interface ToolSpec<T extends TProperties> {
    name: string;
    label: string;
    description: string;
    params: TObject<T>;
    /**
     * Standard domain function: receives pre-scanned graph and merged params,
     * returns text output. Factory handles envelope, json toggle, truncation.
     */
    execute?: (graph: RepoGraph, params: Record<string, unknown>) => string | Promise<string>;
    /**
     * Custom execute for tools with complex logic (async LSP, multi-branch).
     * Receives the full execute context. Factory only merges params.
     * Tool handles its own scanProject, envelope, json toggle, truncation.
     */
    customExecute?: (toolCallId: string, params: Record<string, unknown>, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback<unknown> | undefined, ctx: ExtensionContext) => Promise<AgentToolResult>;
}
/**
 * Register a tool with automatic parameter merging and optional boilerplate.
 *
 * - If `execute` is provided: factory handles scanProject, json toggle,
 *   envelope wrapping, and maxTokens truncation.
 * - If `customExecute` is provided: tool handles everything; factory only
 *   merges json/maxTokens into the parameter schema.
 */
export declare function createTool<T extends TProperties>(pi: ExtensionAPI, spec: ToolSpec<T>): void;
