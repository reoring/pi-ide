/**
 * pi-ide core/graph — Symbol dependency graph data model.
 *
 * Ported from repomap/src/__init__.py (Symbol, Edge, RepoGraph dataclasses).
 * All other core/ modules depend on these types.
 */
// ── Factory ──────────────────────────────────────────────────────────────────
export function createRepoGraph() {
    return {
        symbols: new Map(),
        outgoing: new Map(),
        incoming: new Map(),
        fileSymbols: new Map(),
        fileImports: new Map(),
        fileCalls: new Map(),
        fileImportBindings: new Map(),
        fileExports: new Map(),
    };
}
// ── Symbol factory ───────────────────────────────────────────────────────────
export function createSymbol(id, name, kind, file, line, overrides = {}) {
    return {
        id,
        name,
        kind,
        file,
        line,
        endLine: overrides.endLine ?? line,
        col: overrides.col ?? 0,
        visibility: overrides.visibility ?? "public",
        docstring: overrides.docstring ?? "",
        signature: overrides.signature ?? "",
        returnType: overrides.returnType ?? "",
        params: overrides.params ?? "",
        pagerank: overrides.pagerank ?? 0.0,
    };
}
// ── Edge factory ─────────────────────────────────────────────────────────────
export function createEdge(source, target, weight, kind, confidence = 1.0) {
    return { source, target, weight, kind, confidence };
}
export function serializeSymbol(sym) {
    return {
        id: sym.id,
        name: sym.name,
        kind: sym.kind,
        file: sym.file,
        line: sym.line,
        endLine: sym.endLine,
        col: sym.col,
        visibility: sym.visibility,
        signature: sym.signature,
        returnType: sym.returnType,
        params: sym.params,
        docstring: sym.docstring,
        pagerank: sym.pagerank,
    };
}
export function serializeEdge(edge) {
    return {
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        kind: edge.kind,
        confidence: edge.confidence,
    };
}
export function serializeGraph(graph) {
    const symbols = [];
    for (const sym of graph.symbols.values()) {
        symbols.push(serializeSymbol(sym));
    }
    const edges = [];
    for (const [, edgeList] of graph.outgoing) {
        for (const edge of edgeList) {
            edges.push(serializeEdge(edge));
        }
    }
    return {
        symbols,
        edges,
        version: 1,
        timestamp: Date.now(),
    };
}
export function serializeGraphV2(graph, fileMtimes) {
    const symbols = [];
    for (const sym of graph.symbols.values()) {
        symbols.push(serializeSymbol(sym));
    }
    const edges = [];
    for (const [, edgeList] of graph.outgoing) {
        for (const edge of edgeList) {
            edges.push(serializeEdge(edge));
        }
    }
    const fileSymbols = {};
    for (const [k, v] of graph.fileSymbols)
        fileSymbols[k] = v;
    const fileImports = {};
    for (const [k, v] of graph.fileImports)
        fileImports[k] = v;
    const fileCalls = {};
    for (const [k, v] of graph.fileCalls)
        fileCalls[k] = v;
    const fileImportBindings = {};
    for (const [k, v] of graph.fileImportBindings)
        fileImportBindings[k] = v;
    const fileExports = {};
    for (const [k, v] of graph.fileExports)
        fileExports[k] = v;
    const fileMtimesObj = {};
    for (const [k, v] of fileMtimes)
        fileMtimesObj[k] = v;
    return {
        version: 3,
        timestamp: Date.now(),
        symbols,
        edges,
        fileSymbols,
        fileImports,
        fileCalls,
        fileImportBindings,
        fileExports,
        fileMtimes: fileMtimesObj,
    };
}
export function deserializeGraphV2(data) {
    const graph = createRepoGraph();
    for (const s of data.symbols) {
        graph.symbols.set(s.id, {
            id: s.id,
            name: s.name,
            kind: s.kind,
            file: s.file,
            line: s.line,
            endLine: s.endLine,
            col: s.col,
            visibility: s.visibility,
            docstring: s.docstring,
            signature: s.signature,
            returnType: s.returnType,
            params: s.params,
            pagerank: s.pagerank,
        });
    }
    for (const e of data.edges) {
        const edge = {
            source: e.source,
            target: e.target,
            weight: e.weight,
            kind: e.kind,
            confidence: e.confidence ?? 1.0,
        };
        const outgoing = graph.outgoing.get(e.source) || [];
        outgoing.push(edge);
        graph.outgoing.set(e.source, outgoing);
        const incoming = graph.incoming.get(e.target) || [];
        incoming.push(edge);
        graph.incoming.set(e.target, incoming);
    }
    for (const [k, v] of Object.entries(data.fileSymbols)) {
        graph.fileSymbols.set(k, v);
    }
    for (const [k, v] of Object.entries(data.fileImports)) {
        graph.fileImports.set(k, v);
    }
    for (const [k, v] of Object.entries(data.fileCalls)) {
        graph.fileCalls.set(k, v);
    }
    for (const [k, v] of Object.entries(data.fileImportBindings)) {
        graph.fileImportBindings.set(k, v);
    }
    for (const [k, v] of Object.entries(data.fileExports)) {
        graph.fileExports.set(k, v);
    }
    return graph;
}
function edgeIdentity(edge) {
    return `${edge.source}|${edge.target}|${edge.kind}`;
}
function edgeIdentityFromRow(row) {
    return `${row.source}|${row.target}|${row.kind}`;
}
function stableKey(sym) {
    return `${sym.file}::${sym.name}::${sym.kind}`;
}
export function compareGraphSnapshots(currentSymbols, currentEdges, previousSymbols, previousEdges) {
    const currentSymMap = new Map(currentSymbols.map((s) => [s.id, s]));
    const prevSymMap = new Map(previousSymbols.map((s) => [s.id, s]));
    const currentIds = new Set(currentSymMap.keys());
    const prevIds = new Set(prevSymMap.keys());
    let addedIds = [...currentIds].filter((id) => !prevIds.has(id));
    let removedIds = [...prevIds].filter((id) => !currentIds.has(id));
    // Stable key matching for line-drift reconciliation
    const addedByKey = new Map();
    for (const sid of addedIds) {
        const s = currentSymMap.get(sid);
        const key = stableKey(s);
        const arr = addedByKey.get(key) || [];
        arr.push(sid);
        addedByKey.set(key, arr);
    }
    const removedByKey = new Map();
    for (const sid of removedIds) {
        const s = prevSymMap.get(sid);
        const key = stableKey(s);
        const arr = removedByKey.get(key) || [];
        arr.push(sid);
        removedByKey.set(key, arr);
    }
    const reconciledPairs = [];
    for (const [key, adds] of addedByKey) {
        const rems = removedByKey.get(key) || [];
        for (let i = 0; i < Math.min(adds.length, rems.length); i++) {
            reconciledPairs.push([rems[i], adds[i]]);
        }
    }
    const reconciledAdded = new Set(reconciledPairs.map((p) => p[1]));
    const reconciledRemoved = new Set(reconciledPairs.map((p) => p[0]));
    addedIds = addedIds.filter((id) => !reconciledAdded.has(id));
    removedIds = removedIds.filter((id) => !reconciledRemoved.has(id));
    // Modified: same ID, signature or location changed
    const commonIds = [...currentIds].filter((id) => prevIds.has(id));
    const modifiedSymbols = [];
    for (const id of commonIds) {
        const cur = currentSymMap.get(id);
        const prev = prevSymMap.get(id);
        const sigChanged = cur.signature !== prev.signature;
        const locChanged = cur.line !== prev.line || cur.endLine !== prev.endLine || cur.file !== prev.file;
        if (sigChanged || locChanged) {
            modifiedSymbols.push({
                id: cur.id,
                name: cur.name,
                file: cur.file,
                visibility: cur.visibility,
                kind: cur.kind,
                lineChange: `${prev.line} -> ${cur.line}`,
                oldSignature: prev.signature,
                newSignature: cur.signature,
                signatureChanged: sigChanged,
                risk: sigChanged ? "HIGH" : "LOW",
            });
        }
    }
    // Reconciled pairs as modified
    for (const [prevId, curId] of reconciledPairs) {
        const cur = currentSymMap.get(curId);
        const prev = prevSymMap.get(prevId);
        const sigChanged = cur.signature !== prev.signature;
        modifiedSymbols.push({
            id: cur.id,
            name: cur.name,
            file: cur.file,
            visibility: cur.visibility,
            kind: cur.kind,
            lineChange: `${prev.line} -> ${cur.line}`,
            oldSignature: prev.signature,
            newSignature: cur.signature,
            signatureChanged: sigChanged,
            risk: sigChanged ? "HIGH" : "LOW",
        });
    }
    // Edge changes
    const currentEdgeSet = new Set(currentEdges.map(edgeIdentity));
    const prevEdgeSet = new Set(previousEdges.map(edgeIdentityFromRow));
    const edgesAdded = [...currentEdgeSet].filter((e) => !prevEdgeSet.has(e));
    const edgesRemoved = [...prevEdgeSet].filter((e) => !currentEdgeSet.has(e));
    return {
        summary: {
            added: addedIds.length,
            removed: removedIds.length,
            modified: modifiedSymbols.length,
            edgesAdded: edgesAdded.length,
            edgesRemoved: edgesRemoved.length,
        },
        addedSymbols: addedIds.map((id) => {
            const s = currentSymMap.get(id);
            return { id: s.id, name: s.name, file: s.file, line: s.line };
        }),
        removedSymbols: removedIds.map((id) => {
            const s = prevSymMap.get(id);
            return { id: s.id, name: s.name, file: s.file, line: s.line };
        }),
        modifiedSymbols,
        callChainChanges: {
            newCalls: edgesAdded.slice(0, 20).map((e) => {
                const [from, to, kind] = e.split("|");
                return { from, to, kind };
            }),
            removedCalls: edgesRemoved.slice(0, 20).map((e) => {
                const [from, to, kind] = e.split("|");
                return { from, to, kind };
            }),
        },
    };
}
