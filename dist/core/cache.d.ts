/**
 * pi-ide core/cache — Graph baseline save/diff for incremental analysis.
 *
 * Ported from repomap/src/__init__.py (get_project_cache_dir, compare_graph_snapshots,
 * IncrementalCache).
 *
 * Uses Node.js fs + path for file I/O, storing cache under
 * ~/.cache/pi-ide/<project-slug>.
 */
import { serializeGraph, serializeSymbol, serializeEdge, compareGraphSnapshots } from "./graph.js";
import type { RepoGraph, SerializedGraph, GraphDiff } from "./graph.js";
/**
 * Get the cache directory for a specific project.
 * Uses MD5 hash of canonical path for isolation.
 */
export declare function getProjectCacheDir(projectPath: string): string;
/**
 * Get the standard cache file paths for a project.
 */
export declare function getCachePaths(projectPath: string): {
    symbols: string;
    git: string;
    lastSnapshot: string;
};
/**
 * Save the current graph as a baseline snapshot.
 */
export declare function saveBaseline(graph: RepoGraph, projectPath: string): string;
/**
 * Load a previously saved baseline snapshot.
 */
export declare function loadBaseline(projectPath: string): SerializedGraph | null;
/**
 * Save the last snapshot (timestamp + metadata only, not full graph).
 */
export declare function saveLastSnapshot(projectPath: string, metadata: Record<string, unknown>): string;
/**
 * Load the last snapshot metadata.
 */
export declare function loadLastSnapshot(projectPath: string): Record<string, unknown> | null;
/**
 * Compute the difference between the current graph and a saved baseline.
 * Returns a structured diff with added/removed/modified symbols and edges.
 */
export declare function diffBaseline(graph: RepoGraph, projectPath: string): GraphDiff | null;
/**
 * Save the full graph + file mtimes to a persistent cache file.
 */
export declare function saveGraphCache(graph: RepoGraph, fileMtimes: Map<string, number>, cachePath: string): void;
export interface GraphCacheData {
    graph: RepoGraph;
    fileMtimes: Map<string, number>;
    timestamp: number;
}
/**
 * Load a persistent graph cache. Returns null if missing, corrupt, wrong
 * version, or older than 7 days.
 */
export declare function loadGraphCache(cachePath: string): GraphCacheData | null;
/**
 * Re-export serialization helpers for convenience.
 */
export { serializeGraph, serializeSymbol, serializeEdge, compareGraphSnapshots };
