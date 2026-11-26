"use client";

import { useI18n } from "@/hooks/useI18n";
import { useTableLayout } from "@/hooks/useTablePreferences";
import { useEffect, useId, useRef, useState } from "react";

import {
    COLUMN_DEFS,
    type ColumnDef,
    type ColumnId,
    type ColumnSetting,
    PLANET_TAG_OPTIONS,
    type TableKind,
    type TableView,
    columnDef,
    layoutsEqual,
    moveColumn,
    optionOn,
    setColumnOptions,
    setColumnVisible,
} from "@/lib/tableColumns";

interface TableColumnsMenuProps {
    view: TableView;
    kind: TableKind;
    /** Columns the chart on screen can fill — others are marked "no data for this chart". */
    available: ReadonlySet<ColumnId>;
}

const VIEW_LABEL_KEYS: Record<TableView, string> = {
    charts: "horoscope.charts",
    calculations: "horoscope.calculations",
};

const KIND_LABEL_KEYS: Record<TableKind, string> = {
    houses: "astrology.houses",
    planets: "astrology.planets",
};

/** "Columns" button + popover that edits one table's layout for one view: show/hide, reorder
 *  (drag or arrow buttons), per-column value options, copy from the other tab, reset. Edits apply
 *  live to every open table of the same view and every horoscope uses them — saved to the
 *  user's profile, or for guests to this browser. Hidden only while the session is loading. */
export default function TableColumnsMenu({ view, kind, available }: TableColumnsMenuProps) {
    const { t } = useI18n();
    const { device, layout, defaultLayout, otherViewLayout, canEdit, savedOnDevice, status, setLayout, retry } =
        useTableLayout(view, kind);
    const [open, setOpen] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const titleId = useId();

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
        panelRef.current?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)")?.focus();
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    if (!canEdit) return null;

    const defaults = defaultLayout;
    const isDefault = layoutsEqual(kind, layout, defaults);
    const matchesOther = layoutsEqual(kind, layout, otherViewLayout);
    const otherView: TableView = view === "charts" ? "calculations" : "charts";
    const tableLabel = t(KIND_LABEL_KEYS[kind]);
    const visibleCount = layout.filter((s) => s.visible).length;

    const close = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    const onDrop = (to: number) => {
        if (dragIndex !== null) setLayout(moveColumn(layout, dragIndex, to));
        setDragIndex(null);
        setDropIndex(null);
    };

    const renderOptions = (def: ColumnDef, setting: ColumnSetting) => {
        if (!def.options || !setting.visible) return null;
        if (def.options === PLANET_TAG_OPTIONS) {
            const shown = def.options.filter((o) => optionOn(setting, o.id)).length;
            const setAll = (value: boolean) =>
                setLayout(
                    setColumnOptions(layout, def.id, Object.fromEntries(def.options!.map((o) => [o.id, value]))),
                );
            return (
                <details className="mt-1 ml-7 text-xs">
                    <summary className="cursor-pointer text-gray-600 hover:text-indigo-700 select-none">
                        {t("tableColumns.tags", { shown: String(shown), total: String(def.options.length) })}
                    </summary>
                    <div className="mt-1 flex gap-3">
                        <button type="button" className="text-indigo-600 hover:underline" onClick={() => setAll(true)}>
                            {t("tableColumns.all")}
                        </button>
                        <button type="button" className="text-indigo-600 hover:underline" onClick={() => setAll(false)}>
                            {t("tableColumns.none")}
                        </button>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        {def.options.map((option) => (
                            <label key={option.id} className="flex items-center gap-1.5 text-gray-700">
                                <input
                                    type="checkbox"
                                    className="accent-indigo-600"
                                    checked={optionOn(setting, option.id)}
                                    onChange={(e) =>
                                        setLayout(setColumnOptions(layout, def.id, { [option.id]: e.target.checked }))
                                    }
                                />
                                <span className="truncate">{t(option.labelKey)}</span>
                            </label>
                        ))}
                    </div>
                </details>
            );
        }
        return (
            <div className="mt-1 ml-7 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {def.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-1.5 text-gray-600">
                        <input
                            type="checkbox"
                            className="accent-indigo-600"
                            checked={optionOn(setting, option.id)}
                            onChange={(e) => setLayout(setColumnOptions(layout, def.id, { [option.id]: e.target.checked }))}
                        />
                        {t(option.labelKey)}
                    </label>
                ))}
            </div>
        );
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={t("tableColumns.buttonAria", { table: tableLabel })}
                className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    open ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
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
                <span>{t("tableColumns.button")}</span>
                {!isDefault && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden="true" />}
            </button>

            {open && (
                <div
                    ref={panelRef}
                    id={panelId}
                    role="dialog"
                    aria-labelledby={titleId}
                    className="fixed inset-x-2 bottom-2 max-h-[80vh] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80 sm:max-h-[70vh] z-40 flex flex-col bg-white border rounded-lg shadow-xl text-left normal-case tracking-normal font-normal"
                >
                    <div className="px-3 pt-3 pb-2 border-b">
                        <p id={titleId} className="text-sm font-semibold text-gray-800">
                            {t("tableColumns.title", { table: tableLabel })}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t(VIEW_LABEL_KEYS[view])}
                            {device === "mobile" && <> · {t("tableColumns.phoneLayout")}</>} ·{" "}
                            {t(savedOnDevice ? "tableColumns.savedOnDevice" : "tableColumns.appliesToAll")}
                        </p>
                    </div>

                    <ul className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5" aria-label={t("tableColumns.listAria")}>
                        {layout.map((setting, index) => {
                            const def = columnDef(kind, setting.id);
                            if (!def) return null;
                            const label = t(def.labelKey);
                            const unavailable = !available.has(setting.id);
                            return (
                                <li
                                    key={setting.id}
                                    draggable
                                    onDragStart={(e) => {
                                        setDragIndex(index);
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragOver={(e) => {
                                        if (dragIndex === null) return;
                                        e.preventDefault();
                                        setDropIndex(index);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        onDrop(index);
                                    }}
                                    onDragEnd={() => {
                                        setDragIndex(null);
                                        setDropIndex(null);
                                    }}
                                    className={`rounded px-1 py-1 ${dragIndex === index ? "opacity-40" : ""} ${
                                        dropIndex === index && dragIndex !== index
                                            ? "ring-2 ring-indigo-300 bg-indigo-50"
                                            : "hover:bg-gray-50"
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="cursor-grab text-gray-300 select-none px-0.5" aria-hidden="true">
                                            ⠿
                                        </span>
                                        <label className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                className="accent-indigo-600"
                                                checked={setting.visible}
                                                disabled={def.locked}
                                                onChange={(e) =>
                                                    setLayout(setColumnVisible(kind, layout, setting.id, e.target.checked))
                                                }
                                            />
                                            <span className={`truncate ${setting.visible ? "text-gray-800" : "text-gray-500"}`}>
                                                {label}
                                            </span>
                                            {def.locked ? (
                                                <span className="shrink-0 text-[10px] text-gray-400">
                                                    {t("tableColumns.alwaysShown")}
                                                </span>
                                            ) : (
                                                unavailable && (
                                                    <span
                                                        className="shrink-0 text-[10px] text-amber-600"
                                                        title={t("tableColumns.notAvailableHint")}
                                                    >
                                                        {t("tableColumns.notAvailable")}
                                                    </span>
                                                )
                                            )}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setLayout(moveColumn(layout, index, index - 1))}
                                            disabled={index === 0}
                                            aria-label={t("tableColumns.moveUp", { column: label })}
                                            className="w-6 h-6 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-25 disabled:hover:bg-transparent"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLayout(moveColumn(layout, index, index + 1))}
                                            disabled={index === layout.length - 1}
                                            aria-label={t("tableColumns.moveDown", { column: label })}
                                            className="w-6 h-6 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-25 disabled:hover:bg-transparent"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                    {renderOptions(def, setting)}
                                </li>
                            );
                        })}
                    </ul>

                    <div className="border-t px-3 py-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setLayout(otherViewLayout)}
                                disabled={matchesOther}
                                className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                {t("tableColumns.copyFrom", { tab: t(VIEW_LABEL_KEYS[otherView]) })}
                            </button>
                            <button
                                type="button"
                                onClick={() => setLayout(defaults)}
                                disabled={isDefault}
                                className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                {t("tableColumns.reset")}
                            </button>
                        </div>
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
                                    t("tableColumns.visibleCount", {
                                        shown: String(visibleCount),
                                        total: String(COLUMN_DEFS[kind].length),
                                    })}
                            </p>
                            <button
                                type="button"
                                onClick={close}
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
