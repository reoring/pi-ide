/**
 * pi-ide core/scanner — Project scanning + graph building.
 *
 * Walks project directories, parses source files with tree-sitter,
 * extracts symbols/imports/calls, and builds the full RepoGraph.
 *
 * This is the main entry point that all tools compose from.
 */
import type { RepoGraph } from "./graph.js";
/**
 * Reset all in-memory caches. Used in tests and when cache may be stale.
 */
export declare function resetCache(): void;
/**
 * Get (or build) the project graph with caching.
 * Returns a cached graph if no files have been modified since the last scan.
 * The cache is per-process (not persisted to disk).
 */
export declare function getProjectGraph(projectRoot?: string, log?: (msg: string) => void): RepoGraph;
/**
 * Scan a project directory, parse all source files, build the dependency graph,
 * and compute PageRank scores.
 *
 * Supports persistent caching: on first call, loads from disk cache if available
 * and validates file mtimes. If all files match, returns cached graph instantly.
 * If some files changed, loads cache and does incremental update.
 * Falls back to full scan when no cache exists.
 *
 * @param projectPath - Absolute or relative path to the project root
 * @param log - Optional logger
 * @returns The fully built RepoGraph with PageRank scores set
 */
export declare function scanProject(projectPath: string, log?: (msg: string) => void): RepoGraph;
