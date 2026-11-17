/** Shared empty set handed to collapsed subtrees so their props stay referentially stable and
 *  `React.memo` can skip them when a row elsewhere in the tree is toggled. */
export const EMPTY_PATHS: ReadonlySet<string> = new Set<string>();

/** The expanded-path set a child subtree needs: the real set when the child is open (its own
 *  descendants must look themselves up), otherwise the stable empty set. */
export const pathsFor = (expandedPaths: ReadonlySet<string>, path: string): ReadonlySet<string> =>
    expandedPaths.has(path) ? expandedPaths : EMPTY_PATHS;

/** Builds a tree path such as `md:2/ad:4/vd:1` from per-level indices, stopping at the first missing one. */
export const buildPath = (...indices: (number | null | undefined)[]): string => {
    const levels = ["md", "ad", "vd", "sk", "pr"];
    const parts: string[] = [];
    for (let i = 0; i < indices.length && i < levels.length; i++) {
        const index = indices[i];
        if (index === null || index === undefined) break;
        parts.push(`${levels[i]}:${index}`);
    }
    return parts.join("/");
};

/** Every ancestor path of `path`, including itself (`md:1/ad:2` → `md:1`, `md:1/ad:2`). */
export const ancestorPaths = (path: string): string[] => {
    const parts = path.split("/");
    return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
};
