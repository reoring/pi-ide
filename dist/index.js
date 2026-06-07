/**
 * pi-ide — IDE-style code intelligence for the Pi coding agent.
 *
 * Entry point. Registered as a default export.
 *
 * Layers:
 *   hooks/  → tools/  → core/ + lsp/
 *
 * Core has zero Pi or LSP imports. LSP may import from core.
 */
import { LspManager } from "./lsp/manager.js";
import { generateSetupReport } from "./lsp/setup.js";
import { setLspManager } from "./tools/_context.js";
import { installPreCommitHook, removePreCommitHook, runPreCommitVerify } from "./core/git-hooks.js";
// ── Hook registrations ───────────────────────────────────────────────────
import { registerBeforeStartHook } from "./hooks/before-start.js";
import { registerAfterWriteHook } from "./hooks/after-write.js";
import { registerToolLogger } from "./hooks/tool-logger.js";
import { registerCodeGuide } from "./hooks/code-guide.js";
// ── Tool registrations ────────────────────────────────────────────────────
import { registerOverview } from "./tools/overview.js";
import { registerImpact } from "./tools/impact.js";
import { registerCallChain } from "./tools/call_chain.js";
import { registerVerify } from "./tools/verify.js";
import { registerFix } from "./tools/fix.js";
import { registerHotspots } from "./tools/hotspots.js";
import { registerCodesearch } from "./tools/codesearch.js";
import { registerFileDetail } from "./tools/file_detail.js";
import { registerSymbol } from "./tools/symbol.js";
import { registerHover } from "./tools/hover.js";
import { registerFindTests } from "./tools/find_tests.js";
import { registerTypeHierarchy } from "./tools/type_hierarchy.js";
import { registerRenameSymbol } from "./tools/rename_symbol.js";
import { registerSafeDelete } from "./tools/safe_delete.js";
function isAutoLspEnabled() {
    const value = process.env.PI_IDE_AUTO_LSP;
    return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}
export default function (pi) {
    const projectRoot = process.cwd();
    const log = (msg) => {
        if (pi.logger?.info)
            pi.logger.info(`[pi-ide] ${msg}`);
    };
    // ── LSP manager ─────────────────────────────────────────────────────────
    const lspManager = new LspManager(projectRoot, log);
    // Share LspManager with tools via global reference
    setLspManager(lspManager);
    // Auto-initialize LSP on agent start
    pi.on("before_agent_start", async (_event, _ctx) => {
        if (!isAutoLspEnabled()) {
            log("before_agent_start LSP auto-init disabled. Set PI_IDE_AUTO_LSP=1 to enable it.");
            return;
        }
        try {
            const languages = lspManager.detectLanguages();
            if (languages.length > 0) {
                log(`Detected languages: ${languages.join(", ")}`);
                await lspManager.initializeAll();
            }
        }
        catch (err) {
            log(`LSP init error: ${err}`);
        }
    });
    // Shutdown LSP servers on session shutdown
    pi.on("session_shutdown", async () => {
        log("Shutting down LSP servers...");
        await lspManager.shutdown();
    });
    // ── Hooks ────────────────────────────────────────────────────────────────
    registerBeforeStartHook(pi);
    registerAfterWriteHook(pi);
    registerToolLogger(pi);
    registerCodeGuide(pi);
    // ── /code-setup command ───────────────────────────────────────────────
    pi.registerCommand("code-setup", {
        description: "Detect and report LSP server availability with install instructions",
        async handler(_args, ctx) {
            const report = generateSetupReport(projectRoot);
            ctx.ui?.setStatus?.("code-setup", "LSP setup report generated");
            // Send as a custom message so the user sees the report
            pi.sendMessage({
                customType: "code-setup",
                content: report,
                display: true,
            });
        },
    });
    // ── /code-doctor command ──────────────────────────────────────────────
    pi.registerCommand("code-doctor", {
        description: "Health check: tree-sitter grammars, LSP servers, cache integrity",
        async handler(_args, ctx) {
            const lspReport = generateSetupReport(projectRoot);
            const msg = ["## Pi IDE Doctor — Health Check", "", lspReport].join("\n");
            ctx.ui?.setStatus?.("code-doctor", "Health check complete");
            pi.sendMessage({
                customType: "code-doctor",
                content: msg,
                display: true,
            });
        },
    });
    // ── /code-install-git-hooks command ────────────────────────────────────
    pi.registerCommand("code-install-git-hooks", {
        description: "Install git pre-commit hook that runs code_verify --preCommit",
        async handler(_args, ctx) {
            try {
                const hookPath = installPreCommitHook(projectRoot);
                const msg = [
                    "## Git Pre-Commit Hook Installed",
                    "",
                    `Hook installed at: \`${hookPath}\``,
                    "",
                    "This hook runs code verification before every commit.",
                    "To bypass: \`git commit --no-verify\`",
                    "To uninstall: \`/code-remove-git-hooks\`",
                ].join("\n");
                ctx.ui?.setStatus?.("code-install-git-hooks", "Git pre-commit hook installed");
                pi.sendMessage({ customType: "code-install-git-hooks", content: msg, display: true });
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                pi.sendMessage({
                    customType: "code-install-git-hooks",
                    content: `Failed to install git hook: ${errMsg}`,
                    display: true,
                });
            }
        },
    });
    // ── /code-remove-git-hooks command ─────────────────────────────────────
    pi.registerCommand("code-remove-git-hooks", {
        description: "Remove the code git pre-commit hook",
        async handler(_args, ctx) {
            const removed = removePreCommitHook(projectRoot);
            if (removed) {
                const msg = [
                    "## Git Pre-Commit Hook Removed",
                    "",
                    "The code pre-commit hook has been removed.",
                    "Your original hook (if any) has been restored.",
                ].join("\n");
                ctx.ui?.setStatus?.("code-remove-git-hooks", "Git pre-commit hook removed");
                pi.sendMessage({ customType: "code-remove-git-hooks", content: msg, display: true });
            }
            else {
                pi.sendMessage({
                    customType: "code-remove-git-hooks",
                    content: "No code pre-commit hook found to remove.",
                    display: true,
                });
            }
        },
    });
    // ── /code-pre-commit-verify command (for hook script) ──────────────────
    pi.registerCommand("code-pre-commit-verify", {
        description: "Run pre-commit verification (used by git hook)",
        async handler(_args, ctx) {
            const result = runPreCommitVerify(projectRoot);
            const msg = [
                "## Pre-Commit Verification",
                "",
                `Verdict: ${result.verdict}`,
                `${result.message}`,
            ].join("\n");
            ctx.ui?.setStatus?.("code-pre-commit-verify", `Pre-commit verify: ${result.verdict}`);
            pi.sendMessage({ customType: "code-pre-commit-verify", content: msg, display: true });
        },
    });
    // ── Tools (LLM-visible) ────────────────────────────────────────────────
    registerOverview(pi);
    registerImpact(pi);
    registerCallChain(pi);
    registerVerify(pi);
    registerFix(pi);
    registerHotspots(pi);
    registerCodesearch(pi);
    registerFileDetail(pi);
    registerSymbol(pi);
    registerHover(pi);
    registerFindTests(pi);
    registerTypeHierarchy(pi);
    registerRenameSymbol(pi);
    registerSafeDelete(pi);
    log("pi-ide loaded");
}
