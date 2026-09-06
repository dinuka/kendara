"use client";

import TagColorPicker, { type TagColorSwatch } from "@/components/notepad/TagColorPicker";
import { useI18n } from "@/hooks/useI18n";
import { useMemo, useRef, useState } from "react";

import type { ObservationTag } from "@/models/HoroscopeNote";

import {
    DEFAULT_TAG_COLOR,
    NOTEPAD_TAGS_MAX,
    NOTEPAD_TAG_TEXT_MAX,
    TAG_COLOR_CATALOG,
    housePurposeEntryFor,
} from "@/lib/notepadCatalogs";
import type { TagColor } from "@/lib/notepadCatalogs";

interface NotepadStudentTagsProps {
    /** All student observation tags for the viewed horoscope (caller owns the array). */
    tags: ObservationTag[];
    selectedParentTag: number | null;
    selectedSubTag: string | null;
    onAdd: (tag: ObservationTag) => void;
    onUpdate: (id: string, updates: { text: string; color: TagColor }) => void;
    onDelete: (id: string) => void;
}

/** Chip classes per TagColor — the unified 6-color palette (1 white, 2 lightRed, 3 darkRed,
 *  4 lightGreen, 5 darkGreen, 6 yellow), matching `notepad.observation.classification.*`. Dark
 *  variants are solid chips (saturated background + white text), light variants pastel. */
const TAG_COLOR_CLASSES: Record<number, string> = {
    1: "border-gray-300 bg-white text-gray-700",
    2: "border-red-300 bg-red-50 text-red-700",
    3: "border-red-800 bg-red-600 text-white",
    4: "border-green-300 bg-green-50 text-green-700",
    5: "border-green-800 bg-green-600 text-white",
    6: "border-amber-300 bg-amber-50 text-amber-800",
};

const SWATCH_CLASSES: Record<number, string> = {
    1: "bg-white border border-gray-400",
    2: "bg-red-200",
    3: "bg-red-600",
    4: "bg-green-200",
    5: "bg-green-600",
    6: "bg-amber-400",
};

/** The picker swatches for student tags — the 6 numeric TagColors, labels via `notepad.tagColors.*`. */
function paletteSwatches(t: (key: string, values?: Record<string, string | number>) => string): TagColorSwatch[] {
    return TAG_COLOR_CATALOG.map((color) => ({
        value: color,
        className: SWATCH_CLASSES[color],
        label: t(`notepad.tagColors.${color}`),
    }));
}

/** Class lookup tolerant of corrupt stored colors — falls back to the White neutral. */
function tagColorClass(color: number): string {
    return TAG_COLOR_CLASSES[color] ?? TAG_COLOR_CLASSES[DEFAULT_TAG_COLOR];
}

function swatchClass(color: number): string {
    return SWATCH_CLASSES[color] ?? SWATCH_CLASSES[DEFAULT_TAG_COLOR];
}

/** Student observation tags ("My observations"). Context grouping: no parent selected →
 *  overview grouping (every parent with ≥1 tag); parent selected → that parent's tags; parent +
 *  sub-tag selected → that exact context. Chips are dashed rounded-squares (distinct visual
 *  language from system pills); the composer has a 6-swatch color picker defaulting to White. */
export default function NotepadStudentTags({
    tags,
    selectedParentTag,
    selectedSubTag,
    onAdd,
    onUpdate,
    onDelete,
}: NotepadStudentTagsProps) {
    const { t } = useI18n();
    const [draft, setDraft] = useState("");
    const [draftColor, setDraftColor] = useState<TagColor>(DEFAULT_TAG_COLOR);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [pickerTagId, setPickerTagId] = useState<string | null>(null);
    const pickerAnchorRef = useRef<HTMLButtonElement | null>(null);

    const openPicker = (tagId: string, anchor: HTMLButtonElement) => {
        setPickerTagId(tagId);
        pickerAnchorRef.current = anchor;
    };
    const closePicker = () => {
        setPickerTagId(null);
        pickerAnchorRef.current = null;
    };
    const pickerTag = pickerTagId !== null ? tags.find((tag) => tag.id === pickerTagId) : undefined;

    const atLimit = tags.length >= NOTEPAD_TAGS_MAX;

    const visibleTags = useMemo(() => {
        const sorted = [...tags].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (selectedParentTag === null) {
            return sorted;
        }
        if (selectedSubTag !== null) {
            return sorted.filter((tag) => tag.parentTag === selectedParentTag && tag.subTag === selectedSubTag);
        }
        return sorted.filter((tag) => tag.parentTag === selectedParentTag);
    }, [tags, selectedParentTag, selectedSubTag]);

    const overviewGroups = useMemo(() => {
        if (selectedParentTag !== null) return [];
        const groups = new Map<number, ObservationTag[]>();
        for (const tag of tags) {
            const list = groups.get(tag.parentTag) ?? [];
            list.push(tag);
            groups.set(tag.parentTag, list);
        }
        return [...groups.entries()].sort((a, b) => a[0] - b[0]);
    }, [tags, selectedParentTag]);

    const contextLabel = (tag: ObservationTag) => {
        if (tag.subTag !== null) return t(`notepad.housePurpose.subTags.${tag.subTag}`);
        const entry = housePurposeEntryFor(tag.parentTag);
        return entry ? `${tag.parentTag} — ${t(`notepad.housePurpose.${tag.parentTag}.label`)}` : String(tag.parentTag);
    };

    const submitAdd = () => {
        const text = draft.trim();
        if (!text || atLimit) return;
        const now = new Date().toISOString();
        onAdd({
            id: `tag-${now}-${Math.random().toString(36).slice(2, 8)}`,
            parentTag: selectedParentTag ?? 0,
            subTag: selectedSubTag,
            text,
            color: draftColor,
            createdAt: now,
            updatedAt: now,
        });
        setDraft("");
        setDraftColor(DEFAULT_TAG_COLOR);
    };

    const submitEdit = (id: string) => {
        const text = editingText.trim();
        if (!text) {
            setEditingId(null);
            return;
        }
        onUpdate(id, { text, color: draftColor });
        setEditingId(null);
        setEditingText("");
    };

    const counterTone = (count: number, max: number) =>
        count >= max ? "text-red-600" : count / max >= 0.8 ? "text-amber-600" : "text-gray-400";

    return (
        <div aria-live="polite">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    {t("notepad.studentTags.title")}
                </h3>
            </div>

            {selectedParentTag === null && (
                <p className="text-xs text-gray-500 mb-2">{t("notepad.studentTags.overviewEmpty")}</p>
            )}

            {visibleTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {visibleTags.map((tag) =>
                        selectedParentTag === null ? (
                            <span
                                key={tag.id}
                                className={`inline-flex items-center gap-1 border-2 border-dashed rounded px-2 py-0.5 text-xs ${tagColorClass(tag.color)}`}
                            >
                                <button
                                    type="button"
                                    aria-label={`${contextLabel(tag)}: ${tag.text} — ${t(`notepad.tagColors.${tag.color}`)}`}
                                    onClick={(event) => openPicker(tag.id, event.currentTarget)}
                                    className="text-left"
                                >
                                    <span className="text-[10px] text-gray-500 font-medium">{contextLabel(tag)}:</span>{" "}
                                    <span className="break-words">{tag.text}</span>
                                </button>
                                <button
                                    type="button"
                                    aria-label={t("notepad.studentTags.delete")}
                                    onClick={() => onDelete(tag.id)}
                                    className="text-gray-400 hover:text-red-600"
                                >
                                    ×
                                </button>
                            </span>
                        ) : editingId === tag.id ? (
                            <span key={tag.id} className="inline-flex items-center gap-1">
                                <input
                                    type="text"
                                    value={editingText}
                                    maxLength={NOTEPAD_TAG_TEXT_MAX}
                                    onChange={(event) => setEditingText(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") submitEdit(tag.id);
                                        if (event.key === "Escape") setEditingId(null);
                                    }}
                                    className="border rounded px-2 py-0.5 text-xs w-40"
                                />
                                <button
                                    type="button"
                                    aria-label={t("notepad.studentTags.add")}
                                    onClick={() => submitEdit(tag.id)}
                                    className="text-xs text-indigo-600 hover:text-indigo-800"
                                >
                                    ✓
                                </button>
                            </span>
                        ) : (
                            <span
                                key={tag.id}
                                className={`group inline-flex items-center gap-1 border-2 border-dashed rounded px-2 py-0.5 text-xs ${tagColorClass(tag.color)}`}
                            >
                                <button
                                    type="button"
                                    aria-label={`${tag.text} — ${t(`notepad.tagColors.${tag.color}`)}`}
                                    onClick={(event) => openPicker(tag.id, event.currentTarget)}
                                    className="break-words text-left"
                                >
                                    {tag.text}
                                </button>
                                <button
                                    type="button"
                                    aria-label={t("notepad.studentTags.edit")}
                                    title={t("notepad.studentTags.edit")}
                                    onClick={() => {
                                        setEditingId(tag.id);
                                        setEditingText(tag.text);
                                        setDraftColor(tag.color as TagColor);
                                    }}
                                    className="text-gray-400 hover:text-indigo-600 hidden group-hover:inline"
                                >
                                    ✎
                                </button>
                                <button
                                    type="button"
                                    aria-label={t("notepad.studentTags.delete")}
                                    title={t("notepad.studentTags.delete")}
                                    onClick={() => onDelete(tag.id)}
                                    className="text-gray-400 hover:text-red-600"
                                >
                                    ×
                                </button>
                            </span>
                        ),
                    )}
                </div>
            )}

            {selectedParentTag === null && overviewGroups.length > 0 && (
                <div className="space-y-2 mb-2">
                    {overviewGroups.map(([parentTag, groupTags]) => (
                        <div key={parentTag}>
                            <h4 className="text-[11px] text-gray-500 font-medium mb-1">
                                {t(`notepad.housePurpose.${parentTag}.label`)}
                            </h4>
                            <div className="flex flex-wrap gap-1">
                                {groupTags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className={`inline-flex items-center gap-1 border-2 border-dashed rounded px-2 py-0.5 text-xs ${tagColorClass(tag.color)}`}
                                    >
                                        <button
                                            type="button"
                                            aria-label={`${tag.text} — ${t(`notepad.tagColors.${tag.color}`)}`}
                                            onClick={(event) => openPicker(tag.id, event.currentTarget)}
                                            className="break-words text-left"
                                        >
                                            {tag.text}
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={t("notepad.studentTags.delete")}
                                            onClick={() => onDelete(tag.id)}
                                            className="text-gray-400 hover:text-red-600"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {atLimit ? (
                <p className="text-xs text-red-600">{t("notepad.studentTags.limitReached")}</p>
            ) : (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            value={draft}
                            maxLength={NOTEPAD_TAG_TEXT_MAX}
                            aria-label={t("notepad.studentTags.addPlaceholder")}
                            aria-describedby="notepad-tag-counter"
                            placeholder={t("notepad.studentTags.addPlaceholder")}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") submitAdd();
                            }}
                            className="flex-1 border rounded px-2 py-1 text-xs"
                        />
                        <button
                            type="button"
                            onClick={submitAdd}
                            disabled={!draft.trim()}
                            className="px-2 py-1 rounded bg-indigo-600 text-white text-xs disabled:opacity-40"
                        >
                            {t("notepad.studentTags.add")}
                        </button>
                    </div>
                    <div role="radiogroup" aria-label={t("notepad.tagColors.3")} className="flex items-center gap-1">
                        {TAG_COLOR_CATALOG.map((color) => (
                            <button
                                key={color}
                                type="button"
                                role="radio"
                                aria-checked={draftColor === color}
                                aria-label={t(`notepad.tagColors.${color}`)}
                                onClick={() => setDraftColor(color)}
                                className={`w-5 h-5 rounded-full border border-gray-300 ${swatchClass(color)} ${
                                    draftColor === color ? "ring-2 ring-indigo-500" : ""
                                }`}
                            >
                                {draftColor === color && (
                                    <span aria-hidden className="text-white text-[10px] leading-none">
                                        ✓
                                    </span>
                                )}
                            </button>
                        ))}
                        <span
                            id="notepad-tag-counter"
                            className={`ml-auto text-[10px] ${counterTone(draft.length, NOTEPAD_TAG_TEXT_MAX)}`}
                        >
                            {t("notepad.studentTags.charCount", { count: draft.length, max: NOTEPAD_TAG_TEXT_MAX })}
                        </span>
                    </div>
                </div>
            )}

            {pickerTag && pickerAnchorRef.current && (
                <TagColorPicker
                    swatches={paletteSwatches(t)}
                    current={pickerTag.color}
                    anchor={pickerAnchorRef.current}
                    onPick={(value) => {
                        if (typeof value === "number") {
                            onUpdate(pickerTag.id, { text: pickerTag.text, color: value as TagColor });
                        }
                        closePicker();
                    }}
                    onClose={closePicker}
                />
            )}
        </div>
    );
}
