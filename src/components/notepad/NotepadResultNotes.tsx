"use client";

import { useI18n } from "@/hooks/useI18n";
import { useState } from "react";

import type { ResultNote } from "@/models/HoroscopeNote";

import { NOTEPAD_NOTES_MAX, NOTEPAD_NOTE_TEXT_MAX } from "@/lib/notepadCatalogs";

interface NotepadResultNotesProps {
    notes: ResultNote[];
    onAdd: (note: ResultNote) => void;
    onUpdate: (id: string, text: string) => void;
    onDelete: (id: string) => void;
}

/** Result notes — newest-first cards below the tags (UX Q4). The composer is a multiline textarea
 *  with a live n/2000 counter; at 100 notes it is disabled with a localized message. */
export default function NotepadResultNotes({ notes, onAdd, onUpdate, onDelete }: NotepadResultNotesProps) {
    const { t } = useI18n();
    const [draft, setDraft] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");

    const atLimit = notes.length >= NOTEPAD_NOTES_MAX;
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const submitAdd = () => {
        const text = draft.trim();
        if (!text || atLimit) return;
        const now = new Date().toISOString();
        onAdd({
            id: `note-${now}-${Math.random().toString(36).slice(2, 8)}`,
            text,
            createdAt: now,
            updatedAt: now,
        });
        setDraft("");
    };

    const submitEdit = (id: string) => {
        const text = editingText.trim();
        if (!text) {
            setEditingId(null);
            return;
        }
        onUpdate(id, text);
        setEditingId(null);
        setEditingText("");
    };

    const counterTone = (count: number, max: number) =>
        count >= max ? "text-red-600" : count / max >= 0.8 ? "text-amber-600" : "text-gray-400";

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    {t("notepad.resultNotes.title")}
                </h3>
            </div>

            {sorted.length === 0 && <p className="text-xs text-gray-500 mb-2">{t("notepad.resultNotes.empty")}</p>}

            <div className="space-y-1 mb-2">
                {sorted.map((note) =>
                    editingId === note.id ? (
                        <div key={note.id} className="border rounded p-2">
                            <textarea
                                value={editingText}
                                maxLength={NOTEPAD_NOTE_TEXT_MAX}
                                onChange={(event) => setEditingText(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                        submitEdit(note.id);
                                    }
                                    if (event.key === "Escape") setEditingId(null);
                                }}
                                className="w-full border rounded px-2 py-1 text-xs resize-y"
                            />
                            <div className="flex items-center justify-end gap-1 mt-1">
                                <span className="text-[10px] text-gray-400">
                                    {t("notepad.studentTags.charCount", {
                                        count: editingText.length,
                                        max: NOTEPAD_NOTE_TEXT_MAX,
                                    })}
                                </span>
                                <button
                                    type="button"
                                    aria-label={t("notepad.resultNotes.add")}
                                    onClick={() => submitEdit(note.id)}
                                    className="px-2 py-1 rounded bg-indigo-600 text-white text-xs"
                                >
                                    ✓
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div key={note.id} className="border rounded p-2 bg-white">
                            <p className="text-xs text-gray-800 whitespace-pre-wrap break-words">{note.text}</p>
                            <div className="flex justify-end gap-2 mt-1">
                                <button
                                    type="button"
                                    aria-label={t("notepad.resultNotes.edit")}
                                    onClick={() => {
                                        setEditingId(note.id);
                                        setEditingText(note.text);
                                    }}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800"
                                >
                                    {t("notepad.resultNotes.edit")}
                                </button>
                                <button
                                    type="button"
                                    aria-label={t("notepad.resultNotes.delete")}
                                    onClick={() => onDelete(note.id)}
                                    className="text-[10px] text-red-600 hover:text-red-800"
                                >
                                    {t("notepad.resultNotes.delete")}
                                </button>
                            </div>
                        </div>
                    ),
                )}
            </div>

            {atLimit ? (
                <p className="text-xs text-red-600">{t("notepad.resultNotes.limitReached")}</p>
            ) : (
                <div>
                    <textarea
                        value={draft}
                        maxLength={NOTEPAD_NOTE_TEXT_MAX}
                        aria-label={t("notepad.resultNotes.addPlaceholder")}
                        aria-describedby="notepad-note-counter"
                        placeholder={t("notepad.resultNotes.addPlaceholder")}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                submitAdd();
                            }
                        }}
                        className="w-full border rounded px-2 py-1 text-xs resize-y"
                        rows={3}
                    />
                    <div className="flex items-center justify-between mt-1">
                        <span
                            id="notepad-note-counter"
                            className={`text-[10px] ${counterTone(draft.length, NOTEPAD_NOTE_TEXT_MAX)}`}
                        >
                            {t("notepad.studentTags.charCount", { count: draft.length, max: NOTEPAD_NOTE_TEXT_MAX })}
                        </span>
                        <button
                            type="button"
                            onClick={submitAdd}
                            disabled={!draft.trim()}
                            className="px-2 py-1 rounded bg-indigo-600 text-white text-xs disabled:opacity-40"
                        >
                            {t("notepad.resultNotes.add")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
