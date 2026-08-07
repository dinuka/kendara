"use client";

import HouseTableEditor from "@/components/ManualChart/HouseTableEditor";
import NavamsaHouseTableEditor from "@/components/ManualChart/NavamsaHouseTableEditor";
import { useI18n } from "@/hooks/useI18n";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import ValidationBadges from "@/components/ManualChart/ValidationBadges";
import { compute, deriveNavamsaLagnaFromDegree, navamsaLagnaOptions } from "@/lib/manualChart";
import type { ManualChartResult } from "@/lib/manualChart";
import type { ComputedManualPosition } from "@/lib/manualChartDetails";

interface ManualChartEditorProps {
    mode: "create" | "edit";
    horoscopeId?: string;
    initialName?: string;
    initialBirthDate?: string;
    initialLagna?: number;
    initialLagnaDegree?: number;
    initialNavamsaLagna?: number;
    initialHouses?: Record<number, number[]>;
    initialNavamsaHouses?: Record<number, number[]>;
    onSaved?: () => void;
    onCancel?: () => void;
}

export default function ManualChartEditor({
    mode,
    horoscopeId,
    initialName = "",
    initialBirthDate = "",
    initialLagna = 0,
    initialLagnaDegree,
    initialNavamsaLagna = 0,
    initialHouses = {},
    initialNavamsaHouses = {},
    onSaved,
    onCancel,
}: ManualChartEditorProps) {
    const { t } = useI18n();
    const router = useRouter();
    const [name, setName] = useState(initialName);
    const [birthDate, setBirthDate] = useState(initialBirthDate);
    const [lagna, setLagna] = useState(initialLagna);
    const [lagnaDegree, setLagnaDegree] = useState(initialLagnaDegree !== undefined ? String(initialLagnaDegree) : "");
    const [navamsaLagna, setNavamsaLagna] = useState(initialNavamsaLagna);
    const [houses, setHouses] = useState<Record<number, number[]>>(initialHouses);
    const [navamsaHouses, setNavamsaHouses] = useState<Record<number, number[]>>(initialNavamsaHouses);
    const [positions, setPositions] = useState<ComputedManualPosition[] | null>(null);
    const [autofillMsg, setAutofillMsg] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const preview: ManualChartResult | null = useMemo(() => {
        if (lagna < 1) return null;
        try {
            return compute({ lagna, navamsaLagna: navamsaLagna || undefined, houses, navamsaHouses });
        } catch {
            return null;
        }
    }, [lagna, navamsaLagna, houses, navamsaHouses]);

    const navamsaSignOptions = useMemo(() => {
        if (lagna < 1) return [] as number[];
        return navamsaLagnaOptions(lagna);
    }, [lagna]);

    useEffect(() => {
        if (navamsaLagna >= 1 && !navamsaSignOptions.includes(navamsaLagna)) {
            setNavamsaLagna(0);
            setNavamsaHouses({});
        }
    }, [navamsaLagna, navamsaSignOptions]);

    const parsedDegree = lagnaDegree.trim() === "" ? NaN : Number(lagnaDegree);
    const degreeValid = lagna >= 1 && Number.isFinite(parsedDegree) && parsedDegree >= 0 && parsedDegree < 30;

    useEffect(() => {
        if (degreeValid) {
            const derived = deriveNavamsaLagnaFromDegree(lagna, parsedDegree);
            setNavamsaLagna((prev) => (prev === derived ? prev : derived));
        }
    }, [lagna, parsedDegree, degreeValid]);

    const birthDateValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
    const requestSeq = useRef(0);

    useEffect(() => {
        if (!birthDateValid || lagna < 1) {
            setPositions(null);
            return;
        }
        const seq = ++requestSeq.current;
        setAutofillMsg(t("manualChart.autofillLoading"));
        const timer = setTimeout(async () => {
            try {
                const res = await fetch("/api/horoscope/manual/positions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        date: birthDate,
                        lagna,
                        navamsaLagna: navamsaLagna || undefined,
                    }),
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (seq !== requestSeq.current) return;
                setPositions(data.positions);
                setHouses(data.houses);
                if (data.navamsaHouses && navamsaLagna >= 1) {
                    setNavamsaHouses(data.navamsaHouses);
                }
                setAutofillMsg(t("manualChart.autofillFilled"));
                setError(null);
            } catch {
                if (seq !== requestSeq.current) return;
                setPositions(null);
                setAutofillMsg(t("manualChart.autofillFailed"));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [birthDate, birthDateValid, lagna, lagnaDegree, parsedDegree, degreeValid, navamsaLagna, t]);

    const computedHouseByPlanet = useMemo(() => {
        const map: Record<number, number> = {};
        positions?.forEach((p) => {
            map[p.planet] = p.house;
        });
        return map;
    }, [positions]);

    const computedNavamsaHouseByPlanet = useMemo(() => {
        const map: Record<number, number> = {};
        positions?.forEach((p) => {
            if (p.navamsaHouse !== null) map[p.planet] = p.navamsaHouse;
        });
        return map;
    }, [positions]);

    const addPlanet = (table: "birth" | "navamsa", house: number, planet: number) => {
        setError(null);
        const setter = table === "birth" ? setHouses : setNavamsaHouses;
        setter((prev) => {
            const inHouse = (prev[house] ?? []).filter((p) => p !== planet);
            if (inHouse.length >= 8) return prev;
            const cleaned: Record<number, number[]> = {};
            Object.entries(prev).forEach(([k, planets]) => {
                cleaned[Number(k)] = planets.filter((p) => p !== planet);
            });
            const current = cleaned[house] ?? [];
            cleaned[house] = [...current, planet];
            return cleaned;
        });
    };

    const removePlanet = (table: "birth" | "navamsa", house: number, planet: number) => {
        const setter = table === "birth" ? setHouses : setNavamsaHouses;
        setter((prev) => {
            const next = { ...prev };
            const current = (next[house] ?? []).filter((p) => p !== planet);
            if (current.length > 0) {
                next[house] = current;
            } else {
                delete next[house];
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (lagna < 1) {
            setError(t("manualChart.invalidLagna"));
            return;
        }
        if (mode === "create" && !name.trim()) {
            setError(t("horoscope.name_required") || t("manualChart.name"));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const url = mode === "create" ? "/api/horoscope/manual" : `/api/horoscope/${horoscopeId}/manual-chart`;
            const res = await fetch(url, {
                method: mode === "create" ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim() ? name : undefined,
                    birthDate: birthDateValid ? birthDate : undefined,
                    lagna,
                    lagnaDegree: degreeValid ? parsedDegree : undefined,
                    navamsaLagna: navamsaLagna || undefined,
                    houses,
                    navamsaHouses: Object.keys(navamsaHouses).length > 0 ? navamsaHouses : undefined,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? t("manualChart.saveFailed"));
            }
            if (mode === "create") {
                const h = await res.json();
                router.push(`/horoscopes/${h.horoscope._id}`);
            } else {
                onSaved?.();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t("manualChart.saveFailed"));
            setSaving(false);
        }
    };

    return (
        <form
            id="create-mode-panel"
            role="tabpanel"
            aria-labelledby={mode === "create" ? "create-mode-manual" : undefined}
            onSubmit={handleSubmit}
            className="space-y-4"
        >
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                        {t("common.cancel")}
                    </button>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1">{t("manualChart.name")}</label>
                <input
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={mode === "create"}
                    className="w-full max-w-md border rounded px-3 py-2 text-sm"
                />
            </div>

            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        {t("manualChart.birthDate")}{" "}
                        <span className="text-xs font-normal text-gray-400">{t("manualChart.birthDateOptional")}</span>
                    </label>
                    <input
                        type="date"
                        name="birthDate"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full max-w-xs border rounded px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">{t("manualChart.birthDateHint")}</p>
                    {autofillMsg && <p className="text-xs text-indigo-600 mt-1">{autofillMsg}</p>}
                </div>

                <div className="lg:grid lg:grid-cols-2 lg:gap-6">
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("manualChart.lagna")}</label>
                            <select
                                value={lagna}
                                onChange={(e) => setLagna(Number(e.target.value))}
                                required
                                className="w-48 border rounded px-3 py-2 text-sm"
                            >
                                <option value={0} disabled>
                                    —
                                </option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((sign) => (
                                    <option key={sign} value={sign}>
                                        {t(`astrology.signNames.${sign}`)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("manualChart.lagnaDegree")}</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step={0.01}
                                min={0}
                                max={30}
                                value={lagnaDegree}
                                onChange={(e) => setLagnaDegree(e.target.value)}
                                placeholder={t("manualChart.lagnaDegreePlaceholder")}
                                className="w-44 border rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    {lagna >= 1 && (
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("manualChart.navamsaLagna")}</label>
                            <select
                                value={navamsaLagna}
                                onChange={(e) => {
                                    const value = Number(e.target.value);
                                    setNavamsaLagna(value);
                                    if (value === 0) setNavamsaHouses({});
                                }}
                                className="w-48 border rounded px-3 py-2 text-sm"
                            >
                                <option value={0}>—</option>
                                {navamsaSignOptions.map((sign) => (
                                    <option key={sign} value={sign}>
                                        {t(`astrology.signNames.${sign}`)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {lagna >= 1 && preview && (
                <>
                    <div className="lg:grid lg:grid-cols-2 lg:gap-4">
                        <div>
                            <HouseTableEditor
                                lagna={lagna}
                                houses={houses}
                                computedHouseByPlanet={computedHouseByPlanet}
                                onAdd={(house, planet) => addPlanet("birth", house, planet)}
                                onRemove={(house, planet) => removePlanet("birth", house, planet)}
                            />
                            <ValidationBadges validation={preview.manualHousePlacements.validation} scope="birth" />
                        </div>

                        <div className="bg-white rounded-lg border p-4">
                            <h3 className="font-semibold text-sm text-indigo-700 uppercase tracking-wide flex items-center gap-2 mb-3">
                                {t("manualChart.navamsaTableTitle")}
                                <span className="text-xs font-normal text-gray-400 normal-case tracking-normal">
                                    ({t("manualChart.navamsaOptional")})
                                </span>
                            </h3>
                            {navamsaLagna >= 1 ? (
                                <NavamsaHouseTableEditor
                                    navamsaLagna={navamsaLagna}
                                    navamsaHouses={navamsaHouses}
                                    computedNavamsaHouseByPlanet={computedNavamsaHouseByPlanet}
                                    onAdd={(house, planet) => addPlanet("navamsa", house, planet)}
                                    onRemove={(house, planet) => removePlanet("navamsa", house, planet)}
                                />
                            ) : (
                                <p className="text-xs text-gray-400">{t("manualChart.navamsaEmpty")}</p>
                            )}
                            {navamsaLagna >= 1 && (
                                <ValidationBadges
                                    validation={preview.manualHousePlacements.validation}
                                    scope="navamsa"
                                />
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={saving || lagna < 1}
                    className="w-full max-w-xs bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    {saving
                        ? t("manualChart.saving")
                        : mode === "create"
                          ? t("manualChart.save")
                          : t("manualChart.saveChanges")}
                </button>
                {mode === "edit" && onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={saving}
                        className="px-4 py-2 border rounded hover:bg-gray-50 text-sm"
                    >
                        {t("manualChart.cancel")}
                    </button>
                )}
            </div>
        </form>
    );
}
