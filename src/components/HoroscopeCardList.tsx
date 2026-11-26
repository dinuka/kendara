"use client";

import { useI18n } from "@/hooks/useI18n";
import { ReactNode } from "react";

import { formatDate } from "@/lib/date";
import Link from "next/link";

export interface HoroscopeCardItem {
    _id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
}

interface HoroscopeCardListProps<T extends HoroscopeCardItem> {
    items: T[];
    renderBadge: (h: T) => ReactNode;
    canEdit: (h: T) => boolean;
    onEdit: (h: T) => void;
    onDelete: (h: T) => void;
}

/** Phone layout for horoscope lists: one card per horoscope carrying every table column (name,
 *  birth date/time, location, privacy, actions) so nothing needs a horizontal scroll. Pages render
 *  this below `md` and their `<table>` from `md` up. */
export default function HoroscopeCardList<T extends HoroscopeCardItem>({
    items,
    renderBadge,
    canEdit,
    onEdit,
    onDelete,
}: HoroscopeCardListProps<T>) {
    const { t } = useI18n();

    return (
        <ul className="divide-y">
            {items.map((h) => {
                const location = h.locationName || (h.latitude ? `${h.latitude}, ${h.longitude}` : "");
                return (
                    <li key={h._id} className="flex items-start gap-2 px-3 py-3">
                        <Link
                            href={`/horoscopes/${h._id}`}
                            className="min-w-0 flex-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                            <div className="flex items-start gap-2">
                                <span className="min-w-0 font-medium text-indigo-600 break-words">{h.name}</span>
                                <span className="shrink-0 mt-0.5">{renderBadge(h)}</span>
                            </div>
                            <dl className="mt-1 space-y-0.5 text-xs text-gray-500">
                                <div className="flex gap-1.5">
                                    <dt className="sr-only">{t("horoscope.birthDate")}</dt>
                                    <CalendarIcon />
                                    <dd className="tabular-nums">
                                        {formatDate(h.birthDate)} {h.birthTime}
                                    </dd>
                                </div>
                                {location && (
                                    <div className="flex gap-1.5">
                                        <dt className="sr-only">{t("horoscope.location")}</dt>
                                        <PinIcon />
                                        <dd className="min-w-0 break-words">{location}</dd>
                                    </div>
                                )}
                            </dl>
                        </Link>
                        {canEdit(h) && (
                            <div className="flex shrink-0 -mr-1">
                                <button
                                    onClick={() => onEdit(h)}
                                    aria-label={`${t("horoscope.edit")} ${h.name}`}
                                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => onDelete(h)}
                                    aria-label={`${t("common.delete")} ${h.name}`}
                                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    🗑️
                                </button>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

const iconProps = {
    className: "w-3.5 h-3.5 mt-px shrink-0 text-gray-400",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
};

function CalendarIcon() {
    return (
        <svg {...iconProps}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    );
}

function PinIcon() {
    return (
        <svg {...iconProps}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}
