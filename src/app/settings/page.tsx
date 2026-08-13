"use client";

import AuditLogPanel from "@/components/settings/AuditLogPanel";
import ManagedByAdminNotice from "@/components/settings/ManagedByAdminNotice";
import PlanetAspectsSection from "@/components/settings/PlanetAspectsSection";
import PlanetaryOrbsSection from "@/components/settings/PlanetaryOrbsSection";
import RashiAspectsSection from "@/components/settings/RashiAspectsSection";
import RecalcHistoryPanel from "@/components/settings/RecalcHistoryPanel";
import RecalcStatusPanel from "@/components/settings/RecalcStatusPanel";
import SettingsMetadataStrip from "@/components/settings/SettingsMetadataStrip";
import type { AdminSettingsDoc, RecalcStatus, SettingsValues } from "@/components/settings/types";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import ConflictBanner from "@/components/settings/ConflictBanner";
import { DEFAULT_ORBS } from "@/lib/planetAspects";
import { DEFAULT_RASHI_ASPECTS } from "@/lib/rashiAspects";

/** Normalize any fetched doc into the full editable shape (fallbacks applied; overrides {} not
 *  persisted but always present client-side). */
function toValues(doc: AdminSettingsDoc): SettingsValues {
    return {
        planetaryOrbs: { ...DEFAULT_ORBS, ...doc.planetaryOrbs },
        planetAspects: doc.planetAspects ?? {},
        rashiAspects: { ...DEFAULT_RASHI_ASPECTS, ...doc.rashiAspects, overrides: doc.rashiAspects?.overrides ?? {} },
    };
}

function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

type SaveNotice =
    | { kind: "saved"; message: string }
    | { kind: "recalcStarted"; message: string }
    | { kind: "error"; message: string };

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();

    const isAdmin = session?.user?.role === "super-admin";

    const [adminDoc, setAdminDoc] = useState<AdminSettingsDoc | null>(null);
    const [values, setValues] = useState<SettingsValues | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
    const [conflict, setConflict] = useState(false);
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);
    const [resetConfirming, setResetConfirming] = useState(false);

    const recalcRunning = adminDoc?.recalcStatus?.status === "running";

    const loadDoc = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const res = await fetch(isAdmin ? "/api/admin/astrology-settings" : "/api/settings");
            if (!res.ok) throw new Error("load failed");
            const data = (await res.json()) as AdminSettingsDoc;
            setAdminDoc(data);
            setValues(toValues(data));
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }
        if (status !== "authenticated") return;
        void loadDoc();
    }, [status, router, loadDoc]);

    const baseline = useMemo(() => (adminDoc ? toValues(adminDoc) : null), [adminDoc]);
    const dirty = useMemo(() => !!(values && baseline && !deepEqual(values, baseline)), [values, baseline]);

    useEffect(() => {
        if (!dirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);

    const updateRecalcStatus = useCallback((next: RecalcStatus) => {
        setAdminDoc((prev) => (prev ? { ...prev, recalcStatus: next } : prev));
    }, []);

    /** The recalc POST fires the background job without awaiting its initial status write, so the
     *  response may lag. Optimistically enter "running" (the 3s poll then syncs the real status);
     *  if the response already carries a status, trust it. */
    const applyRecalcTrigger = useCallback(
        (raw: unknown) => {
            const next = (raw as { recalcStatus?: RecalcStatus })?.recalcStatus;
            updateRecalcStatus(next?.status ? next : { status: "running" });
        },
        [updateRecalcStatus],
    );

    const handleRunFull = useCallback(async () => {
        const res = await fetch("/api/admin/astrology-settings/recalc", { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            applyRecalcTrigger(data);
        }
    }, [applyRecalcTrigger]);

    const handleRetryFailed = useCallback(
        async (ids: string[]) => {
            const res = await fetch("/api/admin/astrology-settings/recalc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ horoscopeIds: ids }),
            });
            if (res.ok) {
                const data = await res.json();
                applyRecalcTrigger(data);
            }
        },
        [applyRecalcTrigger],
    );

    const doReload = useCallback(async () => {
        setConfirmingDiscard(false);
        setConflict(false);
        setSaveNotice(null);
        await loadDoc();
    }, [loadDoc]);

    const handleSave = async () => {
        if (!values || !adminDoc || saving || recalcRunning) return;
        setSaving(true);
        setSaveNotice(null);
        try {
            const res = await fetch("/api/admin/astrology-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    version: adminDoc.version ?? 1,
                    planetaryOrbs: values.planetaryOrbs,
                    planetAspects: values.planetAspects,
                    rashiAspects: values.rashiAspects,
                }),
            });
            const data = (await res.json()) as AdminSettingsDoc & {
                noChange?: boolean;
                recalcStarted?: boolean;
                error?: string;
            };
            if (res.ok) {
                setAdminDoc(data);
                setValues(toValues(data));
                setConflict(false);
                setSaveNotice({
                    kind: data.recalcStarted ? "recalcStarted" : "saved",
                    message: data.recalcStarted ? t("settings.system.saveRecalcStarted") : t("settings.saved"),
                });
            } else if (res.status === 409) {
                const msg = data.error ?? "";
                if (msg.includes("in progress")) {
                    setSaveNotice({ kind: "error", message: t("settings.recalc.inProgress") });
                } else {
                    setConflict(true);
                    setSaveNotice(null);
                }
            } else {
                setSaveNotice({
                    kind: "error",
                    message: `${t("settings.errSave")}: ${data.error ?? t("common.error")}`,
                });
            }
        } catch {
            setSaveNotice({ kind: "error", message: t("common.error") });
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = () => {
        setValues({
            planetaryOrbs: { ...DEFAULT_ORBS },
            planetAspects: {},
            rashiAspects: { enabled: true, overrides: {} },
        });
        setResetConfirming(false);
        setSaveNotice(null);
    };

    if (status === "loading" || (loading && !loadError))
        return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    if (!session) return null;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>

            <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">{t("settings.language")}</label>
                    <LanguageToggles />
                </div>

                <hr className="border-gray-200" />

                {loadError ? (
                    <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
                        <p>{t("common.error")}</p>
                        <button
                            type="button"
                            onClick={() => void loadDoc()}
                            className="mt-2 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                        >
                            {t("common.retry")}
                        </button>
                    </div>
                ) : adminDoc && values ? (
                    <>
                        {isAdmin && (
                            <>
                                <SettingsMetadataStrip doc={adminDoc} />
                                <hr className="border-gray-200" />
                            </>
                        )}
                        {!isAdmin && <ManagedByAdminNotice />}

                        <PlanetaryOrbsSection
                            orbs={values.planetaryOrbs}
                            readOnly={!isAdmin}
                            onChange={isAdmin ? (orbs) => setValues({ ...values, planetaryOrbs: orbs }) : undefined}
                        />

                        <hr className="border-gray-200" />

                        <PlanetAspectsSection
                            planetAspects={values.planetAspects}
                            readOnly={!isAdmin}
                            onChange={isAdmin ? (planetAspects) => setValues({ ...values, planetAspects }) : undefined}
                        />

                        <hr className="border-gray-200" />

                        <RashiAspectsSection
                            rashiAspects={values.rashiAspects}
                            readOnly={!isAdmin}
                            onChange={isAdmin ? (rashiAspects) => setValues({ ...values, rashiAspects }) : undefined}
                        />

                        {isAdmin && (
                            <>
                                {recalcRunning && (
                                    <div
                                        role="status"
                                        className="bg-indigo-50 border border-indigo-100 rounded p-3 text-sm text-indigo-800"
                                    >
                                        {t("settings.recalc.inProgress")}
                                    </div>
                                )}

                                {conflict && (
                                    <ConflictBanner
                                        version={adminDoc.version ?? 1}
                                        dirty={dirty}
                                        confirming={confirmingDiscard}
                                        onReload={() => {
                                            if (dirty) setConfirmingDiscard(true);
                                            else void doReload();
                                        }}
                                        onDiscardConfirm={() => void doReload()}
                                        onCancel={() => setConfirmingDiscard(false)}
                                    />
                                )}

                                {saveNotice && (
                                    <div
                                        role={saveNotice.kind === "error" ? "alert" : "status"}
                                        className={`rounded p-3 text-sm ${
                                            saveNotice.kind === "error"
                                                ? "bg-red-50 border border-red-200 text-red-700"
                                                : "bg-green-50 border border-green-200 text-green-800"
                                        }`}
                                    >
                                        {saveNotice.message}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-3">
                                    {dirty && (
                                        <span className="flex items-center gap-1.5 text-sm text-amber-700">
                                            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
                                            {t("settings.unsavedChanges")}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void handleSave()}
                                        disabled={!dirty || saving || recalcRunning}
                                        aria-busy={saving}
                                        className="px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? t("common.saving") : t("common.save")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setResetConfirming(true)}
                                        className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
                                    >
                                        {t("settings.resetDefaults")}
                                    </button>
                                </div>

                                <hr className="border-gray-200" />

                                <RecalcStatusPanel
                                    recalcStatus={adminDoc.recalcStatus}
                                    onStatusChange={updateRecalcStatus}
                                    onRunFull={() => void handleRunFull()}
                                    onRetryFailed={(ids) => void handleRetryFailed(ids)}
                                />

                                <AuditLogPanel entries={adminDoc.auditLog} />
                                <RecalcHistoryPanel runs={adminDoc.recalcHistory} />
                            </>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-red-600">{t("common.error")}</p>
                )}
            </div>

            {resetConfirming && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("settings.resetConfirmTitle")}
                >
                    <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                        <h2 className="text-lg font-semibold mb-2">{t("settings.resetConfirmTitle")}</h2>
                        <p className="text-sm text-gray-600 mb-4">{t("settings.resetConfirmBody")}</p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setResetConfirming(false)}
                                className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleResetDefaults}
                                className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                            >
                                {t("settings.resetDefaults")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function LanguageToggles() {
    const { locale, setLocale, t } = useI18n();
    return (
        <div className="flex gap-2">
            <button
                onClick={() => setLocale("si")}
                className={`px-4 py-2 rounded text-sm border transition-colors ${
                    locale === "si" ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"
                }`}
            >
                {t("settings.sinhala")}
            </button>
            <button
                onClick={() => setLocale("en")}
                className={`px-4 py-2 rounded text-sm border transition-colors ${
                    locale === "en" ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"
                }`}
            >
                {t("settings.english")}
            </button>
        </div>
    );
}
