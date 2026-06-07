/**
 * pi-shazam core/encoding — Adaptive file encoding reader.
 *
 * Reads files with UTF-8 → GBK → GB2312 fallback.
 * Ported from repomap's encoding detection pattern.
 */
/**
 * Read a file with adaptive encoding fallback:
 * 1. Try UTF-8
 * 2. Try GBK (cp936)
 * 3. Try GB2312
 *
 * Returns the decoded string content.
 */
export declare function readFileAdaptive(filePath: string): string;
/**
 * Detect the most likely encoding for a buffer.
 * Returns one of: "utf-8", "gbk", "gb2312", "unknown".
 */
export declare function detectEncoding(buffer: Buffer): string;
/**
 * Read a file with specific encoding.
 */
export declare function readFileWithEncoding(filePath: string, encoding: string): string;
//# sourceMappingURL=encoding.d.ts.map