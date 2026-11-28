import { NOINDEX_METADATA } from "@/lib/noindexLayout";

export const metadata = NOINDEX_METADATA;

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
    return children;
}
