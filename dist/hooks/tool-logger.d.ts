/**
 * Log shazam tool calls to ~/.pi/hooks/audit/shazam-calls.log (JSONL).
 *
 * Each log entry captures the full result text (truncated at 10KB) for debugging:
 * - call:   ts, project, tool, params
 * - result: ts, project, tool, durationMs, success, error, result (truncated output)
 *
 * With 72h auto-cleanup via radar.ts, log size stays bounded.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
export declare function registerToolLogger(pi: ExtensionAPI): void;
//# sourceMappingURL=tool-logger.d.ts.map