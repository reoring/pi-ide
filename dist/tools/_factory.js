import { Type } from "typebox";
import { scanProject } from "../core/scanner.js";
import { truncateOutput } from "../core/output.js";
// ── Factory function ───────────────────────────────────────────────────────
/**
 * Register a tool with automatic parameter merging and optional boilerplate.
 *
 * - If `execute` is provided: factory handles scanProject, json toggle,
 *   envelope wrapping, and maxTokens truncation.
 * - If `customExecute` is provided: tool handles everything; factory only
 *   merges json/maxTokens into the parameter schema.
 */
export function createTool(pi, spec) {
    const mergedSchema = Type.Object({
        ...spec.params.properties,
        json: Type.Optional(Type.Boolean()),
        maxTokens: Type.Optional(Type.Number()),
    });
    if (spec.customExecute) {
        pi.registerTool({
            name: spec.name,
            label: spec.label,
            description: spec.description,
            parameters: mergedSchema,
            execute: spec.customExecute,
        });
        return;
    }
    if (!spec.execute) {
        throw new Error(`Tool ${spec.name}: either execute or customExecute must be provided`);
    }
    const domainFn = spec.execute;
    pi.registerTool({
        name: spec.name,
        label: spec.label,
        description: spec.description,
        parameters: mergedSchema,
        async execute(_toolCallId, params) {
            const json = params.json ?? false;
            const maxTokens = params.maxTokens;
            const graph = scanProject(".");
            let text = await domainFn(graph, params);
            if (json) {
                try {
                    const parsed = JSON.parse(text);
                    text = JSON.stringify(parsed, null, 2);
                }
                catch {
                    text = JSON.stringify({
                        schema_version: "1.0",
                        command: spec.name.replace("code_", ""),
                        status: "ok",
                        result: text,
                    }, null, 2);
                }
            }
            if (maxTokens && !json) {
                text = truncateOutput(text.split("\n"), maxTokens);
            }
            return {
                content: [
                    {
                        type: "text",
                        text,
                    },
                ],
            };
        },
    });
}
//# sourceMappingURL=_factory.js.map