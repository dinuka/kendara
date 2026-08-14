"use client";

import { useI18n } from "@/hooks/useI18n";
import { useEffect, useId, useRef, useState } from "react";

import {
    SHADBALAYA_KEYS,
    type ShadBalaReason,
    type ShadBalaValue,
    type ShadBalaya,
    type ShadBalayaKey,
    type ShadBalayaPerPlanet,
} from "@/lib/shadBalaya";
import {
    type ShadBalaTooltipTokens,
    composeShadBalaAriaLabel,
    composeShadBalaRatioAria,
    composeShadBalaTooltip,
} from "@/lib/shadBalayaTooltip";

import ShadBalaTooltip from "./ShadBalaTooltip";

export interface ShadBalaTableProps {
    horoscopeId: string;
    /** Stored (merged) Shad Bala table — legacy docs get it recomputed by the page before render. */
    shadbalaya: ShadBalaya;
    /** Owner or super-admin may toggle; share-link viewers and non-owners see it read-only. */
    isEditable: boolean;
    getPlanetName: (planet: number) => string;
    getSignName: (sign: number) => string;
}

interface TooltipPosition {
    top: number;
    left: number;
}

const PLANET_NAMES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function cloneShadBalaya(source: ShadBalaya): ShadBalaya {
    const next: ShadBalaya = {};
    for (const [k, v] of Object.entries(source)) {
        const per: ShadBalayaPerPlanet = { ...v };
        for (const bk of SHADBALAYA_KEYS) {
            const bv = per[bk];
            per[bk] = { ...bv };
        }
        next[k] = per;
    }
    return next;
}

interface ShadBalaCellProps {
    planet: number;
    bala: ShadBalayaKey;
    data: ShadBalaValue;
    isEditable: boolean;
    t: ShadBalaTooltipTokens["t"];
    getPlanetName: (planet: number) => string;
    getSignName: (sign: number) => string;
    isSinhala: boolean;
    onToggle: (planet: number, bala: ShadBalayaKey, value: boolean) => void;
}

/** One bala checkbox + its reason tooltip (UX §7, §2.2). Hover (150ms delay) / focus / tap open the
 *  fixed-position tooltip; `Esc`, blur or mouseleave close it. The native checkbox toggles the bala
 *  (the dot marks a manual override); read-only mode disables it and shows an ⓘ info glyph. */
function ShadBalaCell({
    planet,
    bala,
    data,
    isEditable,
    t,
    getPlanetName,
    getSignName,
    isSinhala,
    onToggle,
}: ShadBalaCellProps) {
    const tokens: ShadBalaTooltipTokens = { t, getSignName, getPlanetName };
    const tooltip = composeShadBalaTooltip(tokens, {
        planet,
        bala,
        value: data.value,
        overridden: data.overridden,
        reasons: data.reasons,
    });
    const aria = composeShadBalaAriaLabel(t, getPlanetName, {
        planet,
        bala,
        value: data.value,
        overridden: data.overridden,
    });

    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<TooltipPosition | null>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const labelRef = useRef<HTMLLabelElement>(null);
    const tooltipId = useId();

    const updatePosition = () => {
        const el = labelRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const GAP = 8;
        const ESTIMATED_HEIGHT = 120;
        let top = rect.top - ESTIMATED_HEIGHT - GAP;
        if (top < 8) top = rect.bottom + GAP;
        let left = rect.left + rect.width / 2;
        left = Math.min(Math.max(left, 160), window.innerWidth - 160);
        setPosition({ top, left });
    };

    const openTooltip = () => {
        updatePosition();
        setOpen(true);
    };
    const closeTooltip = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [open]);

    useEffect(
        () => () => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
        },
        [],
    );

    return (
        <label
            ref={labelRef}
            aria-describedby={open ? tooltipId : undefined}
            onMouseEnter={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                hoverTimer.current = setTimeout(openTooltip, 150);
            }}
            onMouseLeave={closeTooltip}
            onFocusCapture={openTooltip}
            onBlurCapture={closeTooltip}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    closeTooltip();
                    labelRef.current?.querySelector("input")?.focus();
                }
            }}
            className="inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] cursor-pointer"
        >
            <input
                type="checkbox"
                checked={data.value}
                disabled={!isEditable}
                onChange={(event) => onToggle(planet, bala, event.target.checked)}
                aria-label={aria}
                className="h-4 w-4 rounded border-gray-300 accent-indigo-600 disabled:opacity-50"
            />
            {data.overridden && (
                <span
                    className="h-1.5 w-1.5 rounded-full bg-indigo-600"
                    title={t("astrology.shadbalaya.override.title")}
                />
            )}
            {!isEditable && (
                <span className="text-xs text-gray-400" title={t("astrology.shadbalaya.infoGlyph")}>
                    ⓘ
                </span>
            )}
            {open && position && (
                <span
                    className="fixed"
                    role="presentation"
                    style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
                >
                    <ShadBalaTooltip
                        id={tooltipId}
                        heading={tooltip.heading}
                        stateLine={tooltip.stateLine}
                        lines={tooltip.lines}
                        overrideFooter={tooltip.overrideFooter}
                        title={tooltip.title}
                        isSinhala={isSinhala}
                    />
                </span>
            )}
        </label>
    );
}

/** ෂඩ් බලය (Shad Bala) — six planetary strengths table (UX spec). Desktop: 8-column table × 9
 *  planet rows. Mobile: one card per planet with bala chips. Toggles auto-save (500 ms debounce,
 *  last-write-wins) as `overridden: true` (US-SB-008); pending payloads flush with `keepalive` on
 *  unmount (RE-SB-214); a failed PATCH rolls the cell back and shows the localized error toast. */
export default function ShadBalaTable({
    horoscopeId,
    shadbalaya,
    isEditable,
    getPlanetName,
    getSignName,
}: ShadBalaTableProps) {
    const { t, locale } = useI18n();
    const isSinhala = locale === "si";

    const [local, setLocal] = useState<ShadBalaya>(shadbalaya);
    const localRef = useRef<ShadBalaya>(shadbalaya);
    const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const inFlight = useRef<
        Map<string, { planet: number; bala: ShadBalayaKey; prevValue: boolean; prevOverridden: boolean }>
    >(new Map());
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        localRef.current = local;
    });

    // The page recomputes the table on every render, so re-sync local state only when the prop
    // content actually changed (a parent refetch), never on identity churn — that would clobber
    // optimistic toggles mid-debounce.
    const prevSignature = useRef(JSON.stringify(shadbalaya));
    useEffect(() => {
        const signature = JSON.stringify(shadbalaya);
        if (signature !== prevSignature.current) {
            prevSignature.current = signature;
            setLocal(shadbalaya);
        }
    }, [shadbalaya]);

    useEffect(() => {
        if (!saveError) return;
        const timer = setTimeout(() => setSaveError(null), 3000);
        return () => clearTimeout(timer);
    }, [saveError]);

    const getCell = (planet: number, bala: ShadBalayaKey): ShadBalaValue =>
        local[String(planet)]?.[bala] ?? { value: false, overridden: false, reasons: [] };

    const flushKey = async (key: string) => {
        debounceTimers.current.delete(key);
        const inflight = inFlight.current.get(key);
        if (!inflight) return;
        const cell = localRef.current[String(inflight.planet)]?.[inflight.bala];
        try {
            const res = await fetch(`/api/horoscope/${horoscopeId}/shadbalaya`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planet: inflight.planet, bala: inflight.bala, value: cell?.value ?? false }),
            });
            if (!res.ok) throw new Error("PATCH failed");
            if (inFlight.current.get(key) === inflight) inFlight.current.delete(key);
        } catch {
            // Only the latest request for a cell may roll back — a newer toggle superseded this one.
            if (inFlight.current.get(key) === inflight) {
                setLocal((prev) => {
                    const next = cloneShadBalaya(prev);
                    const per = next[String(inflight.planet)];
                    if (per?.[inflight.bala]) {
                        per[inflight.bala] = {
                            ...per[inflight.bala],
                            value: inflight.prevValue,
                            overridden: inflight.prevOverridden,
                        };
                    }
                    return next;
                });
                inFlight.current.delete(key);
                setSaveError(t("astrology.shadbalaya.toast.saveError"));
            }
        }
    };

    const handleToggle = (planet: number, bala: ShadBalayaKey, value: boolean) => {
        setSaveError(null);
        const key = `${planet}.${bala}`;
        setLocal((prev) => {
            const next = cloneShadBalaya(prev);
            const per = next[String(planet)];
            if (per?.[bala]) {
                per[bala] = { ...per[bala], value, overridden: true };
            }
            return next;
        });
        const timer = debounceTimers.current.get(key);
        if (timer) clearTimeout(timer);
        if (!inFlight.current.has(key)) {
            const cell = localRef.current[String(planet)]?.[bala];
            inFlight.current.set(key, {
                planet,
                bala,
                prevValue: cell?.value ?? false,
                prevOverridden: cell?.overridden ?? false,
            });
        }
        debounceTimers.current.set(
            key,
            setTimeout(() => flushKey(key), 500),
        );
    };

    useEffect(() => {
        const timers = debounceTimers.current;
        const current = localRef.current;
        return () => {
            // Flush any debounce still pending on unmount so the last toggle is not lost.
            for (const [key, timer] of timers) {
                clearTimeout(timer);
                const [planetStr, balaStr] = key.split(".");
                const cell = current[planetStr]?.[balaStr as ShadBalayaKey];
                if (!cell) continue;
                fetch(`/api/horoscope/${horoscopeId}/shadbalaya`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        planet: Number(planetStr),
                        bala: balaStr as ShadBalayaKey,
                        value: cell.value,
                    }),
                    keepalive: true,
                }).catch(() => {});
            }
        };
    }, [horoscopeId]);

    const ratioAria = (planet: number, count: number): string =>
        composeShadBalaRatioAria(t, getPlanetName, planet, count);
    const balaNames = (bala: ShadBalayaKey): string => t(`astrology.shadbalaya.balaNames.${bala}`);

    return (
        <section className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3 mb-1">
                <h4 className="font-semibold text-sm text-indigo-700 uppercase tracking-wide">
                    {t("astrology.shadbalaya.title")}
                </h4>
                {!isEditable && (
                    <span className="text-xs text-gray-500">{t("astrology.shadbalaya.readOnlyNotice")}</span>
                )}
            </div>
            <p className="text-xs text-gray-500 mb-3">{t("astrology.shadbalaya.override.hint")}</p>

            {saveError && (
                <p role="alert" className="mb-3 text-sm text-red-600">
                    {saveError}
                </p>
            )}

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">
                                {t("astrology.shadbalaya.columns.planet")}
                            </th>
                            {SHADBALAYA_KEYS.map((bala) => (
                                <th
                                    key={bala}
                                    className="text-center px-2 py-2 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap"
                                >
                                    {t(`astrology.shadbalaya.columns.${bala}`)}
                                </th>
                            ))}
                            <th className="text-right px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">
                                {t("astrology.shadbalaya.columns.ratio")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {PLANET_NAMES.map((planet) => {
                            const count = SHADBALAYA_KEYS.filter((bala) => getCell(planet, bala).value).length;
                            return (
                                <tr key={planet} className="border-b border-gray-100 hover:bg-gray-50/50">
                                    <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                                        {getPlanetName(planet)}
                                    </td>
                                    {SHADBALAYA_KEYS.map((bala) => (
                                        <td key={bala} className="text-center px-1 py-0.5">
                                            <ShadBalaCell
                                                planet={planet}
                                                bala={bala}
                                                data={getCell(planet, bala)}
                                                isEditable={isEditable}
                                                t={t}
                                                getPlanetName={getPlanetName}
                                                getSignName={getSignName}
                                                isSinhala={isSinhala}
                                                onToggle={handleToggle}
                                            />
                                        </td>
                                    ))}
                                    <td className="text-right px-3 py-2 text-gray-700 whitespace-nowrap">
                                        <span aria-label={ratioAria(planet, count)}>
                                            {t("astrology.shadbalaya.ratioFormat", { n: count })}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-3">
                {PLANET_NAMES.map((planet) => {
                    const count = SHADBALAYA_KEYS.filter((bala) => getCell(planet, bala).value).length;
                    return (
                        <div key={planet} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-700 text-sm">{getPlanetName(planet)}</span>
                                <span className="text-xs text-gray-500" aria-label={ratioAria(planet, count)}>
                                    {t("astrology.shadbalaya.ratioFormat", { n: count })}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {SHADBALAYA_KEYS.map((bala) => (
                                    <span
                                        key={bala}
                                        className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700"
                                    >
                                        <ShadBalaCell
                                            planet={planet}
                                            bala={bala}
                                            data={getCell(planet, bala)}
                                            isEditable={isEditable}
                                            t={t}
                                            getPlanetName={getPlanetName}
                                            getSignName={getSignName}
                                            isSinhala={isSinhala}
                                            onToggle={handleToggle}
                                        />
                                        {balaNames(bala)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
