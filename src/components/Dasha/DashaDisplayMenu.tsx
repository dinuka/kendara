"use client";

import { useI18n } from "@/hooks/useI18n";
import { useDashaDisplay } from "@/hooks/useTablePreferences";
import { useEffect, useId, useRef, useState } from "react";

import { DASHA_FIELDS, DASHA_LEVELS, type DashaField, dashaDisplaysEqual } from "@/lib/dashaDisplay";

/** Field toggles, grouped as they read in a row: what the row is, its numbers/tags, then timing. */
const FIELD_GROUPS: { titleKey: string; fields: readonly DashaField[] }[] = [
    { titleKey: "dashaDisplay.groups.labels", fields: ["levelName"] },
    {
        titleKey: "dashaDisplay.groups.numbers",
        fields: ["ownNumbers", "nakshatraNumbers", "conjunctionNumbers", "planetTags"],
    },
    { titleKey: "dashaDisplay.groups.timing", fields: ["dates", "age", "duration"] },
];

interface DashaDisplayMenuProps {
    getDashaLevelName: (level: string) => string;
}

/** "Display" button + panel for the Dasha tab: which parts of each row are shown and how deep the
 *  tree goes. Same persistence as the table Columns menu (profile, or this browser for guests;
 *  phones keep their own settings). A popover from `sm` up, a bottom sheet on phones. */
export default function DashaDisplayMenu({ getDashaLevelName }: DashaDisplayMenuProps) {
    const { t } = useI18n();
    const { device, display, defaultDisplay, canEdit, savedOnDevice, status, setDisplay, retry } = useDashaDisplay();
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const titleId = useId();
    const depthId = useId();

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setOpen(false);
            buttonRef.current?.focus();
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        panelRef.current?.querySelector<HTMLElement>("input, select")?.focus();
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    if (!canEdit) return null;

    const isDefault = dashaDisplaysEqual(display, defaultDisplay);
    const shownCount = DASHA_FIELDS.filter((field) => display.fields[field]).length;
    const toggle = (field: DashaField, on: boolean) =>
        setDisplay({ ...display, fields: { ...display.fields, [field]: on } });

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={t("dashaDisplay.buttonAria")}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    open ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                >
                    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
                    <circle cx="16" cy="6" r="2" />
                    <circle cx="10" cy="12" r="2" />
                    <circle cx="18" cy="18" r="2" />
                </svg>
                <span>{t("dashaDisplay.button")}</span>
                {!isDefault && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden="true" />}
            </button>

            {open && (
                <div
                    ref={panelRef}
                    id={panelId}
                    role="dialog"
                    aria-labelledby={titleId}
                    className="fixed inset-x-2 bottom-2 max-h-[80vh] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80 sm:max-h-[70vh] z-40 flex flex-col bg-white border rounded-lg shadow-xl text-left"
                >
                    <div className="px-3 pt-3 pb-2 border-b">
                        <p id={titleId} className="text-sm font-semibold text-gray-800">
                            {t("dashaDisplay.title")}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {device === "mobile" && <>{t("tableColumns.phoneLayout")} · </>}
                            {t(savedOnDevice ? "tableColumns.savedOnDevice" : "tableColumns.appliesToAll")}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                        <div>
                            <label htmlFor={depthId} className="block text-xs font-medium text-gray-700 mb-1">
                                {t("dashaDisplay.depth")}
                            </label>
                            <select
                                id={depthId}
                                value={display.depth}
                                onChange={(e) => setDisplay({ ...display, depth: Number(e.target.value) })}
                                className="w-full border rounded px-2 py-2 sm:py-1.5 text-sm bg-white"
                            >
                                {DASHA_LEVELS.map((level, index) => (
                                    <option key={level} value={index + 1}>
                                        {getDashaLevelName(level)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {FIELD_GROUPS.map((group) => (
                            <fieldset key={group.titleKey}>
                                <legend className="text-xs font-medium text-gray-700 mb-1">{t(group.titleKey)}</legend>
                                <div className="space-y-0.5">
                                    {group.fields.map((field) => (
                                        <label
                                            key={field}
                                            className="flex items-center gap-2 min-h-9 sm:min-h-0 px-1 py-1 rounded text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                className="accent-indigo-600 w-4 h-4"
                                                checked={display.fields[field]}
                                                onChange={(e) => toggle(field, e.target.checked)}
                                            />
                                            {t(`dashaDisplay.fields.${field}`)}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ))}
                    </div>

                    <div className="px-3 py-2 border-t space-y-2">
                        <button
                            type="button"
                            onClick={() => setDisplay(defaultDisplay)}
                            disabled={isDefault}
                            className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                            {t("tableColumns.reset")}
                        </button>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-500" role="status" aria-live="polite">
                                {status === "saving" && t("tableColumns.status.saving")}
                                {status === "saved" && <span className="text-green-700">✓ {t("tableColumns.status.saved")}</span>}
                                {status === "error" && (
                                    <span className="text-red-600">
                                        {t("tableColumns.status.error")}{" "}
                                        <button type="button" className="underline" onClick={retry}>
                                            {t("tableColumns.status.retry")}
                                        </button>
                                    </span>
                                )}
                                {status === "idle" &&
                                    t("dashaDisplay.shownCount", {
                                        shown: String(shownCount),
                                        total: String(DASHA_FIELDS.length),
                                    })}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    buttonRef.current?.focus();
                                }}
                                className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                                {t("tableColumns.done")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
