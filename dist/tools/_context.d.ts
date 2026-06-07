/**
 * pi-shazam tools/_context — Tool-level shared context for LspManager.
 *
 * Holds the LspManager reference at the tools/ layer (not core/),
 * preserving the dependency direction: tools/ -> lsp/ (correct),
 * not core/ -> lsp/ (wrong).
 *
 * Set during extension init in index.ts, read by LSP-using tools.
 */
import type { LspManager } from "../lsp/manager.js";
export declare function setLspManager(mgr: LspManager): void;
export declare function getLspManager(): LspManager | null;
//# sourceMappingURL=_context.d.ts.map