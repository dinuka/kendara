"use client";

import { useI18n } from "@/hooks/useI18n";
import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

import { ChartType } from "@/lib/chartTypes";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, aliasError, normalizeAlias } from "@/lib/seo";

interface SeoState {
    title: string;
    description: string;
    aliases: string[];
    indexed: boolean;
}

interface SeoEditorProps {
    horoscopeId: string;
}

const EMPTY: SeoState = { title: "", description: "", aliases: [], indexed: true };

/** Super-admin editor for a horoscope's search-engine data: title/description overrides, alias
 *  URLs (/horoscopes/<alias> → this horoscope) and the index switch, with result/share previews. */
export default function SeoEditor({ horoscopeId }: SeoEditorProps) {
    const { t } = useI18n();
    const [seo, setSeo] = useState<SeoState>(EMPTY);
    const [isPublic, setIsPublic] = useState(true);
    const [aliasInput, setAliasInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [origin, setOrigin] = useState("");

    useEffect(() => {
        setOrigin(window.location.origin);
        fetch(`/api/admin/horoscope/${horoscopeId}/seo`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d) => {
                setSeo({
                    title: d.seo?.title ?? "",
                    description: d.seo?.description ?? "",
                    aliases: d.seo?.aliases ?? [],
                    indexed: d.seo?.indexed !== false,
                });
                setIsPublic(Boolean(d.isPublic));
            })
            .catch(() => setMessage({ type: "error", text: t("common.error") }))
            .finally(() => setLoading(false));
    }, [horoscopeId, t]);

    const pendingAlias = normalizeAlias(aliasInput);
    const pendingAliasError = pendingAlias ? aliasError(pendingAlias) : null;

    const addAlias = () => {
        if (!pendingAlias || pendingAliasError || seo.aliases.includes(pendingAlias)) return;
        setSeo((s) => ({ ...s, aliases: [...s.aliases, pendingAlias] }));
        setAliasInput("");
    };

    const onAliasKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addAlias();
        }
    };

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/horoscope/${horoscopeId}/seo`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(seo),
            });
            const body = await res.json().catch(() => ({}));
            if (res.status === 409) {
                setMessage({ type: "error", text: t("horoscope.seo.aliasTaken", { aliases: body.aliases?.join(", ") }) });
            } else if (res.status === 400) {
                setMessage({ type: "error", text: t("horoscope.seo.invalid") });
            } else if (!res.ok) {
                setMessage({ type: "error", text: t("horoscope.seo.saveFailed") });
            } else {
                setMessage({ type: "success", text: t("horoscope.seo.saved") });
            }
        } catch {
            setMessage({ type: "error", text: t("horoscope.seo.saveFailed") });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center py-10 text-gray-500">{t("common.loading")}</div>;

    const pageUrl = `${origin}/horoscopes/${horoscopeId}`;
    const imageUrl = (type: ChartType) => `/api/horoscope/${horoscopeId}/chart/${type}/image`;

    return (
        <section aria-labelledby="seo-editor-title" className="bg-white rounded-lg border p-4 sm:p-6 space-y-5">
            <header>
                <h2 id="seo-editor-title" className="text-lg font-semibold">
                    {t("horoscope.seo.editorTitle")}
                </h2>
                <p className="text-sm text-gray-500">{t("horoscope.seo.editorHint")}</p>
                {!isPublic && (
                    <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">
                        {t("horoscope.seo.notPublic")}
                    </p>
                )}
            </header>

            <div>
                <label htmlFor="seo-title" className="flex justify-between text-sm font-medium text-gray-700">
                    <span>{t("horoscope.seo.title")}</span>
                    <span className={seo.title.length > SEO_TITLE_MAX ? "text-red-600" : "text-gray-400"}>
                        {t("horoscope.seo.chars", { count: seo.title.length, max: SEO_TITLE_MAX })}
                    </span>
                </label>
                <input
                    id="seo-title"
                    type="text"
                    value={seo.title}
                    onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
            </div>

            <div>
                <label htmlFor="seo-description" className="flex justify-between text-sm font-medium text-gray-700">
                    <span>{t("horoscope.seo.description")}</span>
                    <span className={seo.description.length > SEO_DESCRIPTION_MAX ? "text-red-600" : "text-gray-400"}>
                        {t("horoscope.seo.chars", { count: seo.description.length, max: SEO_DESCRIPTION_MAX })}
                    </span>
                </label>
                <textarea
                    id="seo-description"
                    rows={3}
                    value={seo.description}
                    onChange={(e) => setSeo((s) => ({ ...s, description: e.target.value }))}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
            </div>

            <div>
                <label htmlFor="seo-alias" className="text-sm font-medium text-gray-700">
                    {t("horoscope.seo.aliases")}
                </label>
                <p className="text-xs text-gray-500">{t("horoscope.seo.aliasHint", { path: "/horoscopes/<alias>" })}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                    {seo.aliases.map((alias) => (
                        <li
                            key={alias}
                            className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700"
                        >
                            <span>/horoscopes/{alias}</span>
                            <button
                                type="button"
                                aria-label={`${t("common.delete")} ${alias}`}
                                onClick={() => setSeo((s) => ({ ...s, aliases: s.aliases.filter((a) => a !== alias) }))}
                                className="ml-1 text-indigo-400 hover:text-indigo-700"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="mt-2 flex gap-2">
                    <input
                        id="seo-alias"
                        type="text"
                        value={aliasInput}
                        placeholder={t("horoscope.seo.aliasPlaceholder")}
                        onChange={(e) => setAliasInput(e.target.value)}
                        onKeyDown={onAliasKeyDown}
                        aria-invalid={Boolean(pendingAliasError)}
                        className={`flex-1 min-w-0 rounded border px-3 py-2 text-sm ${pendingAliasError ? "border-red-400" : ""}`}
                    />
                    <button
                        type="button"
                        onClick={addAlias}
                        disabled={!pendingAlias || Boolean(pendingAliasError)}
                        className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        {t("horoscope.seo.aliasAdd")}
                    </button>
                </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                    type="checkbox"
                    checked={seo.indexed}
                    onChange={(e) => setSeo((s) => ({ ...s, indexed: e.target.checked }))}
                />
                {t("horoscope.seo.indexed")}
            </label>

            <div className="grid gap-4 md:grid-cols-2">
                <figure className="rounded border p-3">
                    <figcaption className="mb-2 text-xs font-medium uppercase text-gray-400">
                        {t("horoscope.seo.searchPreview")}
                    </figcaption>
                    <p className="truncate text-xs text-gray-500">{pageUrl}</p>
                    <p className="truncate text-lg text-blue-800">{seo.title || "—"}</p>
                    <p className="line-clamp-2 text-sm text-gray-600">{seo.description || "—"}</p>
                </figure>
                <figure className="rounded border p-3">
                    <figcaption className="mb-2 text-xs font-medium uppercase text-gray-400">
                        {t("horoscope.seo.sharePreview")}
                    </figcaption>
                    <div className="grid grid-cols-2 gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- stored PNGs, not optimisable */}
                        <img src={imageUrl(ChartType.BIRTH)} alt="" className="w-full rounded border" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(ChartType.NAVAMSA_D9)} alt="" className="w-full rounded border" />
                    </div>
                    <a
                        href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(pageUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
                    >
                        {t("horoscope.seo.debugger")}
                    </a>
                </figure>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {saving ? t("common.saving") : t("horoscope.seo.save")}
                </button>
                {message && (
                    <p role="status" className={message.type === "success" ? "text-sm text-green-600" : "text-sm text-red-600"}>
                        {message.text}
                    </p>
                )}
            </div>
        </section>
    );
}
