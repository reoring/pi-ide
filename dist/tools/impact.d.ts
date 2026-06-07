/**
 * code tools/impact — Change blast radius analysis.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerImpact(pi: ExtensionAPI): void;
interface ImpactOptions {
    withSymbols: boolean;
    compact: boolean;
}
export declare function executeImpact(graph: RepoGraph, files: string[], opts?: ImpactOptions): string;
export declare function executeImpactJson(graph: RepoGraph, files: string[]): string;
export {};
