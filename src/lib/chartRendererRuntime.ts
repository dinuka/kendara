import { createRequire } from "module";
import path from "path";

import type * as ChartSvgModule from "@/lib/chartSvg";

type ChartRenderer = typeof ChartSvgModule;

let renderer: ChartRenderer | null = null;

/** Loads the pre-compiled chart renderer (.chart-renderer/index.cjs, built by
 *  scripts/build-chart-renderer.mjs) with Node's own require, outside the Next.js bundle — App Router
 *  routes can't import react-dom/server or run client components directly. Throws when the bundle
 *  hasn't been built; callers treat that like any other render failure. */
export const loadChartRenderer = (): ChartRenderer => {
    if (renderer) return renderer;
    const root = process.cwd();
    const nodeRequire = createRequire(path.join(root, "package.json"));
    renderer = nodeRequire(path.join(root, ".chart-renderer", "index.cjs")) as ChartRenderer;
    return renderer;
};
