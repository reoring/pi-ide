/**
 * code tools/hotspots — Complexity hotspot ranking.
 */
import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerHotspots(pi: ExtensionAPI): void;
export declare function executeHotspots(graph: RepoGraph, topN?: number): string;
export declare function executeHotspotsJson(graph: RepoGraph, topN: number): string;
