import type { ExtensionAPI } from "../types/pi-extension.js";
import type { RepoGraph } from "../core/graph.js";
export declare function registerFindTests(pi: ExtensionAPI): void;
interface TestFileMatch {
    testFile: string;
    sourceFile: string;
    type: "direct" | "sibling" | "convention";
    testCount: number;
    tests: string[];
}
interface FindTestsResult {
    matches: TestFileMatch[];
    summary: {
        totalTestFiles: number;
        sourceFiles: number;
    };
}
export declare function executeFindTests(graph: RepoGraph, projectRoot: string, opts: {
    sourceFile?: string;
    module?: string;
}): FindTestsResult;
export {};
