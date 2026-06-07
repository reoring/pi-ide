/**
 * Guide the agent to use ide tools at the right moments.
 *
 * Injects context reminders at key lifecycle points:
 * - before_agent_start: inject ide tool list into system prompt
 * - tool_result (write/edit): suggest running code_verify
 * - tool_result (code_symbol): suggest call_chain when symbol has many callers
 * - tool_call (search/grep/find): suggest code_search
 * - tool_call (write/edit): suggest code_impact for multi-file edits
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
export declare function registerCodeGuide(pi: ExtensionAPI): void;
//# sourceMappingURL=code-guide.d.ts.map