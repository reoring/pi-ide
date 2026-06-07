/**
 * pi-ide core/treesitter-queries — Tree-sitter query patterns for 18 languages.
 *
 * Ported from repomap/src/queries.py.
 * Each language has patterns for: function, class, import, call, http_route.
 */
export interface QueryDict {
    [lang: string]: {
        function?: string;
        class?: string;
        import?: string;
        call?: string;
        http_route?: string;
        http_route_nestjs?: string;
        http_route_explicit?: string;
    };
}
export declare const QUERIES: QueryDict;
//# sourceMappingURL=treesitter-queries.d.ts.map