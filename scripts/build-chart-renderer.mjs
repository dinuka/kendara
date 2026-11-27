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
    // React + next-intl are bundled in (the regular, non react-server build) so the file is
    // self-contained: on Vercel, files loaded with a runtime require aren't traced into the function,
    // so nothing here may depend on node_modules except native resvg, which the app itself imports.
    external: ["@resvg/resvg-js"],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
});

console.log("chart renderer built: .chart-renderer/index.cjs");
