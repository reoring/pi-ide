/**
 * pi-ide hooks/before-start — Inject project overview into system prompt.
 *
 * Registered on the `before_agent_start` event. Scans the project with
 * tree-sitter, generates an overview, and injects it into the system prompt
 * so the LLM has structural awareness before reading any code.
 *
 * Also injects context-sensitive proactive recommendations based on project
 * state (test files, type hierarchy, git status).
 */
import { scanProject } from "../core/scanner.js";
import { executeOverview } from "../tools/overview.js";
import { hasTestFiles, hasHierarchyKinds } from "../core/output.js";
import { execSync } from "node:child_process";
function isAutoOverviewEnabled() {
    const value = process.env.PI_IDE_AUTO_OVERVIEW;
    return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}
/**
 * Get the number of uncommitted changes in the working tree.
 */
function getUncommittedChangeCount(projectRoot) {
    try {
        const output = execSync("git diff --name-only --diff-filter=ACMR 2>/dev/null; git diff --cached --name-only --diff-filter=ACMR 2>/dev/null", { cwd: projectRoot, encoding: "utf-8", timeout: 3000 }).trim();
        if (!output)
            return 0;
        return new Set(output.split("\n").filter(Boolean)).size;
    }
    catch {
        return -1;
    }
}
/**
 * Build proactive recommendations section based on project state.
 */
function buildProactiveRecommendations(projectRoot) {
    const lines = [];
    try {
        const graph = scanProject(projectRoot, () => { });
        const hasTests = hasTestFiles(graph);
        const hasHierarchy = hasHierarchyKinds(graph);
        const uncommitted = getUncommittedChangeCount(projectRoot);
        lines.push("### Proactive Recommendations");
        lines.push("");
        if (uncommitted > 0) {
            lines.push(`- [REQUIRED] You have ${uncommitted} uncommitted change(s). Run \`code_verify --preCommit\` before committing.`);
        }
        lines.push("- Before editing any file for the first time: \`code_file_detail --file <path>\`");
        lines.push("- Before changing a shared/exported symbol: \`code_call_chain --symbol <name>\`");
        if (hasTests) {
            lines.push("- Before adding/modifying code: \`code_find_tests --sourceFile <file>\` to find related tests");
        }
        if (hasHierarchy) {
            lines.push("- When working with OOP types: \`code_type_hierarchy --name <class>\` for inheritance chain");
        }
        lines.push("- When editing 2+ files: \`code_impact --files <file1> <file2>\` to assess blast radius");
        lines.push("- After every edit: \`code_verify\` to check for errors");
        lines.push("- Instead of grep: \`code_search --query <keyword>\` for ranked results");
    }
    catch {
        // If scan fails, provide minimal recommendations
        lines.push("### Recommendations");
        lines.push("");
        lines.push("- \`code_overview\` to understand project structure");
        lines.push("- \`code_file_detail --file <path>\` before editing any file");
        lines.push("- \`code_verify\` after every edit");
    }
    return lines.join("\n");
}
/**
 * Generate a project overview string suitable for system prompt injection.
 *
 * @param projectRoot - Absolute or relative path to the project root
 * @returns A formatted overview string prefixed with [pi-ide] tag
 */
export function generateOverviewForPrompt(projectRoot) {
    const graph = scanProject(projectRoot, () => { });
    const overview = executeOverview(graph, projectRoot);
    const recommendations = buildProactiveRecommendations(projectRoot);
    return `[pi-ide] Project Overview:\n${overview}\n\n${recommendations}`;
}
/**
 * Register the before-start hook on the Pi extension API.
 *
 * On `before_agent_start`, generates a project overview and injects it
 * into the system prompt array.
 */
export function registerBeforeStartHook(pi) {
    pi.on("before_agent_start", async (_event, _ctx) => {
        if (!isAutoOverviewEnabled()) {
            pi.logger?.info("[pi-ide] before_agent_start overview disabled. Set PI_IDE_AUTO_OVERVIEW=1 to enable it.");
            return undefined;
        }
        try {
            const overviewText = generateOverviewForPrompt(".");
            // Append overview to the system prompt
            return {
                systemPrompt: overviewText,
            };
        }
        catch (err) {
            pi.logger?.warn(`[pi-ide] Failed to generate overview: ${err}`);
            // Don't block agent start on overview failure
            return undefined;
        }
    });
}
