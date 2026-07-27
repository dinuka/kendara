"use client";

import { useI18n } from "@/hooks/useI18n";

interface PrivacyBadgeProps {
    isPublic: boolean;
    displayName: boolean;
    isOwner: boolean;
    size: 'sm' | 'md';
}

export default function PrivacyBadge({ isPublic, displayName, isOwner, size }: PrivacyBadgeProps) {
    const { t } = useI18n();

    if (!isPublic) {
        const label = t("horoscope.badge.private");
        return (
            <span
                className={`inline-flex items-center gap-1 rounded ${
                    size === 'sm' ? 'text-[11px] px-1 py-0.5' : 'text-xs px-2 py-1'
                } bg-gray-100 text-gray-600`}
                aria-label={label}
                title={label}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'}>
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {size === 'md' && <span>{label}</span>}
            </span>
        );
    }

    if (!displayName) {
        const label = t("horoscope.badge.name_hidden");
        return (
            <span
                className={`inline-flex items-center gap-1 rounded ${
                    size === 'sm' ? 'text-[11px] px-1 py-0.5' : 'text-xs px-2 py-1'
                } bg-amber-50 text-amber-700`}
                aria-label={label}
                title={label}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'}>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                </svg>
                {size === 'md' && <span>{label}</span>}
            </span>
        );
    }

    const label = t("horoscope.badge.public");
    return (
        <span
            className={`inline-flex items-center gap-1 rounded ${
                size === 'sm' ? 'text-[11px] px-1 py-0.5' : 'text-xs px-2 py-1'
            } bg-green-100 text-green-700`}
            aria-label={label}
            title={label}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'}>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
                <path d="M2 12h20" />
            </svg>
            {size === 'md' && <span>{label}</span>}
        </span>
    );
}
