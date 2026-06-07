/**
 * pi-ide core/git-hooks — Git pre-commit hook integration.
 *
 * Installs a pre-commit hook that runs code_verify --preCommit
 * before allowing a commit. Blocks commit on FAIL verdict.
 *
 * The hook is installed as .git/hooks/pre-commit in the project root.
 * It calls npx code_verify (via the Pi extension's verify tool)
 * through the MCP entry point.
 */
/**
 * Install the pre-commit git hook for the given project.
 *
 * Writes .git/hooks/pre-commit with the ide verify script
 * and makes it executable.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns The path to the installed hook file
 */
export declare function installPreCommitHook(projectRoot: string): string;
/**
 * Check if the pre-commit hook is installed for the given project.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns True if the pi-ide pre-commit hook is installed
 */
export declare function isPreCommitHookInstalled(projectRoot: string): boolean;
/**
 * Remove the installed pre-commit hook, restoring any backup if present.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns True if the hook was removed
 */
export declare function removePreCommitHook(projectRoot: string): boolean;
/**
 * Run pre-commit verification synchronously.
 * Used by the pre-commit hook script.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns { verdict: "PASS" | "FAIL" | "WARN", message: string }
 */
export declare function runPreCommitVerify(projectRoot: string): {
    verdict: "PASS" | "FAIL" | "WARN";
    message: string;
};
//# sourceMappingURL=git-hooks.d.ts.map
