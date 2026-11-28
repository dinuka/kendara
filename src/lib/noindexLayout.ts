import type { Metadata } from "next";

/** Metadata for private / utility routes (sign-in, settings, admin, editors): kept out of search
 *  results, links still followed. Re-exported by those routes' layout.tsx. */
export const NOINDEX_METADATA: Metadata = { robots: { index: false, follow: true } };
