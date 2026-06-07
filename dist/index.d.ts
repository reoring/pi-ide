/**
 * pi-ide — Pi coding agent native codebase awareness extension.
 *
 * Entry point. Registered as a default export.
 *
 * Layers:
 *   hooks/  → tools/  → core/ + lsp/
 *
 * Core has zero Pi or LSP imports. LSP may import from core.
 */
import type { ExtensionAPI } from "./types/pi-extension.js";
export default function (pi: ExtensionAPI): void;
//# sourceMappingURL=index.d.ts.map