"use client";

import { useI18n } from "@/hooks/useI18n";
import { useRef } from "react";

import { HOUSE_PURPOSE_CATALOG, housePurposeEntryFor } from "@/lib/notepadCatalogs";

interface NotepadTagStripProps {
    selectedParentTag: number | null;
    selectedSubTag: string | null;
    onSelectParent: (parentTag: number | null) => void;
    onSelectSubTag: (subTag: string | null) => void;
}

/** Parent + sub-tag selection strip (UX Q2). Parent chips are the 13 fixed parents
 *  (1–12 then Other); sub-tag chips render only for a selected parent (never for Other).
 *  Arrow keys move the selection (radio-group pattern); the selected chip holds tabindex 0. */
export default function NotepadTagStrip({
    selectedParentTag,
    selectedSubTag,
    onSelectParent,
    onSelectSubTag,
}: NotepadTagStripProps) {
    const { t } = useI18n();
    const parentRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const subTagRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const parentLabel = (parentTag: number) => {
        if (parentTag === 0) return t("notepad.housePurpose.0.label");
        return `${parentTag} — ${t(`notepad.housePurpose.${parentTag}.label`)}`;
    };

    const subTags =
        selectedParentTag !== null && selectedParentTag !== 0
            ? (housePurposeEntryFor(selectedParentTag)?.subTags ?? [])
            : [];

    const parentTabIndex = (parentTag: number) => {
        if (selectedParentTag !== null) return parentTag === selectedParentTag ? 0 : -1;
        return parentTag === HOUSE_PURPOSE_CATALOG[0].parentTag ? 0 : -1;
    };

    const handleParentKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const count = HOUSE_PURPOSE_CATALOG.length;
        let next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            next = (index + 1) % count;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            next = (index - 1 + count) % count;
        } else if (event.key === "Home") {
            event.preventDefault();
            next = 0;
        } else if (event.key === "End") {
            event.preventDefault();
            next = count - 1;
        } else {
            return;
        }
        const parentTag = HOUSE_PURPOSE_CATALOG[next].parentTag;
        if (parentTag !== selectedParentTag) {
            onSelectParent(parentTag);
        }
        parentRefs.current[next]?.focus();
    };

    const handleSubTagKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const count = subTags.length;
        let next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            next = (index + 1) % count;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            next = (index - 1 + count) % count;
        } else if (event.key === "Home") {
            event.preventDefault();
            next = 0;
        } else if (event.key === "End") {
            event.preventDefault();
            next = count - 1;
        } else {
            return;
        }
        const subTag = subTags[next];
        if (subTag !== selectedSubTag) {
            onSelectSubTag(subTag);
        }
        subTagRefs.current[next]?.focus();
    };

    return (
        <div className="border-b border-gray-200 p-3">
            <div role="group" aria-label={t("notepad.aria.parentStrip")} className="flex flex-wrap gap-1">
                {HOUSE_PURPOSE_CATALOG.map(({ parentTag }, index) => {
                    const selected = parentTag === selectedParentTag;
                    return (
                        <button
                            key={parentTag}
                            ref={(el) => {
                                parentRefs.current[index] = el;
                            }}
                            type="button"
                            tabIndex={parentTabIndex(parentTag)}
                            aria-pressed={selected}
                            onClick={() => {
                                if (parentTag !== selectedParentTag) {
                                    onSelectParent(parentTag);
                                }
                            }}
                            onKeyDown={(event) => handleParentKeyDown(event, index)}
                            className={`px-2 py-1 rounded-full text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                selected
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                            }`}
                        >
                            {parentLabel(parentTag)}
                        </button>
                    );
                })}
            </div>
            {subTags.length > 0 && (
                <div role="group" aria-label={t("notepad.aria.subTagStrip")} className="flex flex-wrap gap-1 mt-2">
                    {subTags.map((subTagKey, index) => {
                        const selected = subTagKey === selectedSubTag;
                        return (
                            <button
                                key={subTagKey}
                                ref={(el) => {
                                    subTagRefs.current[index] = el;
                                }}
                                type="button"
                                tabIndex={selected ? 0 : -1}
                                aria-pressed={selected}
                                aria-label={t(`notepad.housePurpose.subTags.${subTagKey}`)}
                                onClick={() => {
                                    if (subTagKey !== selectedSubTag) {
                                        onSelectSubTag(subTagKey);
                                    }
                                }}
                                onKeyDown={(event) => handleSubTagKeyDown(event, index)}
                                className={`px-1.5 py-0.5 rounded text-[11px] border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                    selected
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300"
                                }`}
                            >
                                {t(`notepad.housePurpose.subTags.${subTagKey}`)}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
