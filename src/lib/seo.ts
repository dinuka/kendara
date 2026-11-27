/** SEO helpers shared by the horoscope page, the admin SEO route and the sitemap. Pure — no DB. */

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 200;
export const SEO_ALIAS_MAX_COUNT = 20;

/** Stored chart PNGs are rendered at 2x from a 420px SVG (src/lib/chartImage.ts). */
export const CHART_IMAGE_SIZE = 840;

/** Static `/horoscopes/<segment>` routes an alias must never shadow. */
const RESERVED_ALIASES = new Set(["new", "edit", "manual"]);

const ALIAS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export interface HoroscopeSeo {
    title?: string;
    description?: string;
    aliases: string[];
    indexed: boolean;
}

export const isObjectId = (value: string): boolean => OBJECT_ID_PATTERN.test(value);

/** Lowercases and trims an alias; spaces and underscores become hyphens. */
export const normalizeAlias = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

/** Why an (already normalised) alias is rejected, or null when it is valid. */
export const aliasError = (alias: string): string | null => {
    if (alias.length < 2 || alias.length > 60) return "length";
    if (!ALIAS_PATTERN.test(alias)) return "format";
    if (isObjectId(alias)) return "objectId";
    if (RESERVED_ALIASES.has(alias)) return "reserved";
    return null;
};

/** Validates an SEO payload from the admin editor. Returns the cleaned value or a list of errors. */
export const parseSeoInput = (
    body: unknown,
): { ok: true; seo: HoroscopeSeo } | { ok: false; errors: Record<string, string> } => {
    const input = (body ?? {}) as Record<string, unknown>;
    const errors: Record<string, string> = {};

    const title = typeof input.title === "string" ? input.title.trim() : "";
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (title.length > SEO_TITLE_MAX) errors.title = "length";
    if (description.length > SEO_DESCRIPTION_MAX) errors.description = "length";

    const rawAliases = Array.isArray(input.aliases) ? input.aliases : [];
    const aliases = [...new Set(rawAliases.filter((a): a is string => typeof a === "string").map(normalizeAlias))].filter(
        Boolean,
    );
    if (aliases.length > SEO_ALIAS_MAX_COUNT) errors.aliases = "count";
    for (const alias of aliases) {
        const error = aliasError(alias);
        if (error) {
            errors[`alias:${alias}`] = error;
        }
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    return {
        ok: true,
        seo: {
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            aliases,
            indexed: input.indexed !== false,
        },
    };
};

/** The render timestamp inside a chart image key (`charts/<id>/<type>-<ts>.png`), used as a cache
 *  version so the image URL changes whenever the chart is re-rendered. */
export const chartImageVersion = (imageKey?: string | null): string | null => {
    const match = imageKey?.match(/-(\d+)\.png$/);
    return match ? match[1] : null;
};

/** Absolute origin of the site, used for canonical URLs, og:image and the sitemap. */
export const siteUrl = (): string =>
    (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

/** Cache-Control for a chart image: a URL carrying the current render version (`?v=<ts>`) is
 *  content-addressed and safe to cache for a year; anything else keeps a short TTL because the
 *  unversioned URL is reused across recalculations. */
export const chartImageCacheControl = (
    requestedVersion: string | null,
    imageKey: string | null | undefined,
    isPublic: boolean,
): string => {
    const scope = isPublic ? "public" : "private";
    const current = chartImageVersion(imageKey);
    if (requestedVersion && current && requestedVersion === current) {
        return `${scope}, max-age=31536000, immutable`;
    }
    return `${scope}, max-age=300`;
};
