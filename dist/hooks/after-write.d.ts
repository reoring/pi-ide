/**
 * pi-shazam hooks/after-write — Auto-verify after write/edit operations.
 *
 * Registered on the `tool_result` event. When the LLM writes or edits a file,
 * this hook automatically runs diagnostics (scan + verify) and sends findings
 * back to the conversation.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
/**
 * Determine if a tool result should trigger automatic verification.
 *
 * @param toolName - Name of the tool that was executed
 * @param isError - Whether the tool execution resulted in an error
 * @returns true if verification should run
 */
export declare function shouldTriggerVerify(toolName: string, isError: boolean): boolean;
/**
 * Handle a write/edit tool result by running diagnostics and reporting findings.
 *
 * @param toolName - The tool that was executed (write or edit)
 * @param projectRoot - Project root directory
 * @returns Diagnostic findings as a formatted text string
 */
export declare function handleWriteResult(toolName: string, projectRoot: string): string;
/**
 * Register the after-write hook on the Pi extension API.
 *
 * On `tool_result` for write/edit operations, runs diagnostics and sends
 * findings via pi.sendMessage().
 */
export declare function registerAfterWriteHook(pi: ExtensionAPI): void;
//# sourceMappingURL=after-write.d.ts.map