/**
 * pi-ide core/pagerank — PageRank importance scoring on RepoGraph.
 *
 * Ported from repomap/src/ranking.py (GraphAnalyzer.calculate_pagerank).
 *
 * The algorithm is pure iterative PageRank with convergence detection.
 * No external dependencies beyond the graph data model.
 */
import type { RepoGraph } from "./graph.js";
/**
 * Calculate PageRank scores for all symbols in the graph.
 * Scores are stored directly on each symbol's `.pagerank` field.
 *
 * Damping factor: 0.85 (standard PageRank)
 * Max iterations: 50
 * Convergence tolerance: 1e-6
 */
export declare function calculatePageRank(graph: RepoGraph, damping?: number, maxIter?: number, tol?: number): void;
