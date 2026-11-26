// Pre-compiles the server-side chart renderer (src/lib/chartSvg.tsx) into a plain Node module.
//
// Why: Next.js App Router API routes are bundled with React's server-component build, which forbids
// react-dom/server and can't run client components (BirthChart/HouseChart use hooks). Compiled
// here and loaded at runtime with Node's own require (src/lib/chartRendererRuntime.ts), the
// renderer uses the regular React build — same as the browser. Run automatically by `pnpm dev` /
// `pnpm build`; re-run (or restart dev) after changing the chart components.
import { build } from "esbuild";

await build({
    entryPoints: ["src/lib/chartSvg.tsx"],
    outfile: ".chart-renderer/index.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    jsx: "automatic",
    tsconfig: "tsconfig.json",
    // resolved from node_modules at runtime: the regular (non react-server) React build + native resvg
    external: ["react", "react-dom", "next-intl", "use-intl", "@resvg/resvg-js"],
    logLevel: "warning",
});

console.log("chart renderer built: .chart-renderer/index.cjs");
