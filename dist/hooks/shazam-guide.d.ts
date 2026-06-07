/**
 * Guide the agent to use shazam tools at the right moments.
 *
 * Injects context reminders at key lifecycle points:
 * - before_agent_start: inject shazam tool list into system prompt
 * - tool_result (write/edit): suggest running shazam_verify
 * - tool_result (shazam_symbol): suggest call_chain when symbol has many callers
 * - tool_call (search/grep/find): suggest shazam_codesearch
 * - tool_call (write/edit): suggest shazam_impact for multi-file edits
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
export declare function registerShazamGuide(pi: ExtensionAPI): void;
//# sourceMappingURL=shazam-guide.d.ts.map