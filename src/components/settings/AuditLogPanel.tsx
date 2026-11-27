"use client";

import type { AuditChange, AuditEntry } from "@/components/settings/types";
import { useI18n } from "@/hooks/useI18n";

import { formatDate } from "@/lib/date";

interface ChangeLine {
    label: string;
    from: string;
    to: string;
}

const fmt = (value: unknown): string => (value === undefined ? "—" : JSON.stringify(value));

/** Flatten a stored whole-field change into leaf-level `field.path: from → to` lines, matching the
 *  audit log wireframe (orbs per key, planetAspects per planet houses/degrees, rashi enabled). */
function describeChanges(changes: AuditChange, t: ReturnType<typeof useI18n>["t"]): ChangeLine[] {
    const lines: ChangeLine[] = [];

    if (changes.planetaryOrbs) {
        const fromMap = (changes.planetaryOrbs.from ?? {}) as Record<string, number>;
        const toMap = (changes.planetaryOrbs.to ?? {}) as Record<string, number>;
        const keys = [...new Set([...Object.keys(fromMap), ...Object.keys(toMap)])].sort();
        for (const key of keys) {
            const f = fromMap[key];
            const n = toMap[key];
            if (f === n) continue;
            lines.push({
                label: `${t("settings.audit.fieldPlanetaryOrbs")}["${key}"]`,
                from: String(f),
                to: String(n),
            });
        }
    }

    if (changes.planetAspects) {
        const fromMap = (changes.planetAspects.from ?? {}) as Record<string, { houses: number[]; degrees: number[] }>;
        const toMap = (changes.planetAspects.to ?? {}) as Record<string, { houses: number[]; degrees: number[] }>;
        const keys = [...new Set([...Object.keys(fromMap), ...Object.keys(toMap)])].sort();
        for (const key of keys) {
            const f = fromMap[key];
            const n = toMap[key];
            if (JSON.stringify(f?.houses) !== JSON.stringify(n?.houses)) {
                lines.push({
                    label: `${t("settings.audit.fieldPlanetAspects")}["${key}"].houses`,
                    from: fmt(f?.houses),
                    to: fmt(n?.houses),
                });
            }
            if (JSON.stringify(f?.degrees) !== JSON.stringify(n?.degrees)) {
                lines.push({
                    label: `${t("settings.audit.fieldPlanetAspects")}["${key}"].degrees`,
                    from: fmt(f?.degrees),
                    to: fmt(n?.degrees),
                });
            }
        }
    }

    if (changes.rashiAspects) {
        const f = changes.rashiAspects.from as { enabled?: boolean; overrides?: Record<string, { enabled?: boolean }> };
        const n = changes.rashiAspects.to as { enabled?: boolean; overrides?: Record<string, { enabled?: boolean }> };
        const fEnabled = f?.enabled;
        const nEnabled = n?.enabled;
        if (fEnabled !== nEnabled) {
            lines.push({
                label: `${t("settings.audit.fieldRashiAspects")}.enabled`,
                from: String(fEnabled),
                to: String(nEnabled),
            });
        }
        const fromOver = (f?.overrides ?? {}) as Record<string, { enabled?: boolean }>;
        const toOver = (n?.overrides ?? {}) as Record<string, { enabled?: boolean }>;
        const signs = [...new Set([...Object.keys(fromOver), ...Object.keys(toOver)])].sort();
        for (const sign of signs) {
            const fSign = fromOver[sign]?.enabled;
            const nSign = toOver[sign]?.enabled;
            if (fSign !== nSign) {
                lines.push({
                    label: `${t("settings.audit.fieldRashiAspects")}.overrides["${sign}"].enabled`,
                    from: String(fSign),
                    to: String(nSign),
                });
            }
        }
    }

    return lines;
}

interface AuditLogPanelProps {
    entries?: AuditEntry[];
}

/** Default-collapsed settings change log (US-SAS-011). Capped at 100 entries server-side; newest
 *  first here. Native `<details>` keeps the collapse/expand accessible with zero JS. */
export default function AuditLogPanel({ entries }: AuditLogPanelProps) {
    const { t } = useI18n();
    const list = entries ? [...entries].reverse() : [];

    return (
        <details className="group border-t border-gray-200 pt-4">
            <summary className="cursor-pointer flex items-center justify-between gap-2 text-sm font-medium text-gray-700 select-none">
                <span>
                    <span aria-hidden="true" className="mr-2 text-gray-400 transition-transform group-open:rotate-90">
                        ▸
                    </span>
                    {t("settings.audit.title")}
                </span>
                {list.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{list.length}</span>
                )}
            </summary>
            <div className="mt-3 space-y-3">
                {list.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("settings.audit.empty")}</p>
                ) : (
                    list.map((entry) => {
                        const fromVersion = entry.version - 1;
                        const lines = describeChanges(entry.changes, t);
                        return (
                            <div key={entry.id} className="border rounded p-3">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-mono">
                                        {t("settings.audit.versionFromTo", { from: fromVersion, to: entry.version })}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                        {entry.changedBy.name || entry.changedBy.id.slice(-6)}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-gray-500">{formatDate(entry.changedAt)}</span>
                                </div>
                                <div className="mt-2 space-y-0.5">
                                    {lines.length === 0 ? (
                                        <p className="text-xs text-gray-400">—</p>
                                    ) : (
                                        lines.map((line, i) => (
                                            <p key={i} className="text-xs text-gray-600 font-mono break-all">
                                                <span className="text-gray-500">{line.label}:</span> {line.from} →{" "}
                                                {line.to}
                                            </p>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </details>
    );
}
