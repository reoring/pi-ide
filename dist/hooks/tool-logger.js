/**
 * Log code tool calls to ~/.pi/hooks/audit/code-calls.log (JSONL).
 *
 * Each log entry captures the full result text (truncated at 10KB) for debugging:
 * - call:   ts, project, tool, params
 * - result: ts, project, tool, durationMs, success, error, result (truncated output)
 *
 * With 72h auto-cleanup via radar.ts, log size stays bounded.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const AUDIT_DIR = join(homedir(), ".pi", "hooks", "audit");
const LOG_FILE = join(AUDIT_DIR, "code-calls.log");
const MAX_RESULT_CHARS = 10_000;
const _starts = new Map();
function ensureDir() {
    mkdirSync(AUDIT_DIR, { recursive: true });
}
function ts() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const tz = `${sign}${pad(Math.floor(Math.abs(off) / 60))}${pad(Math.abs(off) % 60)}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tz}`;
}
function write(entry) {
    try {
        ensureDir();
        appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
    }
    catch {
        /* silent */
    }
}
function isIdeTool(name) {
    return name.startsWith("code_");
}
function summarize(v) {
    if (v === null || v === undefined)
        return v;
    if (typeof v === "string")
        return v.length > 200 ? `[${v.length} chars]` : v;
    if (Array.isArray(v))
        return `[${v.length} items]`;
    if (typeof v === "object") {
        const s = {};
        for (const [k, val] of Object.entries(v)) {
            s[k] = summarize(val);
        }
        return s;
    }
    return v;
}
export function registerToolLogger(pi) {
    pi.on("tool_call", (event, ctx) => {
        if (!isIdeTool(event.toolName))
            return;
        const t0 = Date.now();
        _starts.set(event.toolCallId, t0);
        const input = "input" in event ? event.input : {};
        write({
            ts: ts(),
            project: ctx.cwd,
            event: "call",
            tool: event.toolName,
            params: summarize(input),
        });
    });
    pi.on("tool_result", (event, ctx) => {
        if (!isIdeTool(event.toolName))
            return;
        const start = _starts.get(event.toolCallId);
        const durationMs = start != null ? Date.now() - start : -1;
        _starts.delete(event.toolCallId);
        // Extract full result text
        const texts = [];
        if (event.content) {
            for (const c of event.content) {
                if (typeof c === "object" && "text" in c)
                    texts.push(c.text);
            }
        }
        const combined = texts.join("\n");
        const truncated = combined.length > MAX_RESULT_CHARS
            ? combined.slice(0, MAX_RESULT_CHARS) + `\n... [truncated at ${MAX_RESULT_CHARS} chars, total was ${combined.length}]`
            : combined;
        write({
            ts: ts(),
            project: ctx.cwd,
            event: "result",
            tool: event.toolName,
            durationMs,
            success: !event.isError,
            error: event.isError ? (texts[0]?.slice(0, 300) ?? null) : null,
            result: truncated,
        });
    });
}
