"use client";

import NotepadObservations from "@/components/notepad/NotepadObservations";
import NotepadPlanetStrengths from "@/components/notepad/NotepadPlanetStrengths";
import NotepadResultNotes from "@/components/notepad/NotepadResultNotes";
import NotepadStudentTags from "@/components/notepad/NotepadStudentTags";
import NotepadTagStrip from "@/components/notepad/NotepadTagStrip";
import { useI18n } from "@/hooks/useI18n";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ObservationTag, ResultNote } from "@/models/HoroscopeNote";

import {
    NOTEPAD_MAX_HEIGHT,
    NOTEPAD_MAX_WIDTH,
    NOTEPAD_MIN_HEIGHT,
    NOTEPAD_MIN_WIDTH,
    housePurposeEntryFor,
} from "@/lib/notepadCatalogs";
import type { CalculatedDetailsLike } from "@/lib/notepadObservations";

interface NotepadProps {
    horoscopeId: string;
    calculatedDetails: CalculatedDetailsLike | null;
}

interface NoteDoc {
    notepadState: {
        position: { x: number; y: number };
        size: { width: number; height: number };
        isOpen?: boolean;
        selectedParentTag?: number;
        selectedSubTag?: string | null;
    } | null;
    observationTags: ObservationTag[];
    resultNotes: ResultNote[];
    /** Student color overrides for derived system tags, keyed by `observationTagId(...)`. */
    observationTagOverrides: Record<string, string>;
    /** Derived system tags the student marked not relevant (`observationTagId(...)` keys) — struck
     *  through and excluded from every section's ratio. */
    irrelevantTagIds: string[];
    /** Student determinations of planet-factor classifications, keyed by planet "1"–"9" then factor
     *  key — the effective factor colors feed every planet's ratio badge and strength panel. */
    planetFactorOverrides: Record<string, Record<string, string>>;
}

const EMPTY_DOC: NoteDoc = {
    notepadState: null,
    observationTags: [],
    resultNotes: [],
    observationTagOverrides: {},
    irrelevantTagIds: [],
    planetFactorOverrides: {},
};

const DEFAULT_SIZE = { width: 480, height: 640 };
const DOCK_MARGIN = 16;
const NUDGE_STEP = 8;
const RESIZE_STEP = 16;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function defaultGeometry(): NonNullable<NoteDoc["notepadState"]> {
    const width = Math.min(DEFAULT_SIZE.width, window.innerWidth - DOCK_MARGIN * 2);
    const height = Math.min(DEFAULT_SIZE.height, window.innerHeight - DOCK_MARGIN * 2);
    return {
        position: { x: Math.max(DOCK_MARGIN, window.innerWidth - width - DOCK_MARGIN), y: 80 },
        size: { width, height },
    };
}

function clampGeometry(state: NonNullable<NoteDoc["notepadState"]>): NonNullable<NoteDoc["notepadState"]> {
    const width = clamp(
        state.size.width,
        NOTEPAD_MIN_WIDTH,
        Math.min(NOTEPAD_MAX_WIDTH, window.innerWidth - DOCK_MARGIN),
    );
    const height = clamp(
        state.size.height,
        NOTEPAD_MIN_HEIGHT,
        Math.min(NOTEPAD_MAX_HEIGHT, window.innerHeight - DOCK_MARGIN),
    );
    const x = clamp(state.position.x, DOCK_MARGIN, Math.max(DOCK_MARGIN, window.innerWidth - width - DOCK_MARGIN));
    const y = clamp(state.position.y, DOCK_MARGIN, Math.max(DOCK_MARGIN, window.innerHeight - height - DOCK_MARGIN));
    return { ...state, position: { x, y }, size: { width, height } };
}

/** The Student Notepad popup (UX Q1/Q4/Q5). Owns the note document state, the debounced save
 *  pipeline with rollback, the fetch lifecycle keyed on `horoscopeId` (stale-guarded), and the
 *  drag/resize/keyboard geometry. The system observation sections derive from `calculatedDetails`
 *  (page props) — only student tags/notes ever show a loading state. */
export default function Notepad({ horoscopeId, calculatedDetails }: NotepadProps) {
    const { t } = useI18n();
    const [doc, setDoc] = useState<NoteDoc>(EMPTY_DOC);
    const [loading, setLoading] = useState(true);
    const [saveFailed, setSaveFailed] = useState(false);
    const [expandedPlanet, setExpandedPlanet] = useState<number | null>(null);

    const docRef = useRef(doc);
    const confirmedRef = useRef<NoteDoc>(EMPTY_DOC);
    const dirtyRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const horoscopeIdRef = useRef(horoscopeId);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
    const [resizing, setResizing] = useState<{ x: number; y: number } | null>(null);
    const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);

    docRef.current = doc;

    // --- persistence ---------------------------------------------------------

    const persist = useCallback(async (target: NoteDoc, id: string, keepalive = false) => {
        try {
            const res = await fetch(`/api/horoscope/${id}/note`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(target),
                keepalive,
            });
            if (!res.ok) return false;
            const body = (await res.json()) as { success?: boolean };
            return body?.success !== false;
        } catch {
            return false;
        }
    }, []);

    const flush = useCallback(
        async (keepalive = false) => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            if (!dirtyRef.current) return;
            dirtyRef.current = false;
            const ok = await persist(docRef.current, horoscopeIdRef.current, keepalive);
            if (ok) {
                confirmedRef.current = docRef.current;
            } else if (!keepalive) {
                setDoc(confirmedRef.current);
                setSaveFailed(true);
                setTimeout(() => setSaveFailed(false), 3000);
            }
        },
        [persist],
    );

    const scheduleSave = useCallback(() => {
        dirtyRef.current = true;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            void flush();
        }, 500);
    }, [flush]);

    const applyAndSchedule = useCallback(
        (mutate: (current: NoteDoc) => NoteDoc) => {
            setDoc((current) => {
                const next = mutate(current);
                scheduleSave();
                return next;
            });
        },
        [scheduleSave],
    );

    // Fetch lifecycle (per horoscope, stale-guarded).
    useEffect(() => {
        let cancelled = false;
        horoscopeIdRef.current = horoscopeId;
        setLoading(true);
        setDoc(EMPTY_DOC);
        confirmedRef.current = EMPTY_DOC;
        dirtyRef.current = false;
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        void (async () => {
            const res = await fetch(`/api/horoscope/${horoscopeId}/note`);
            if (cancelled) return;
            if (res.ok) {
                const body = (await res.json()) as NoteDoc;
                confirmedRef.current = body;
                setDoc({
                    notepadState: body.notepadState ? clampGeometry(body.notepadState) : null,
                    observationTags: body.observationTags ?? [],
                    resultNotes: body.resultNotes ?? [],
                    observationTagOverrides: body.observationTagOverrides ?? {},
                    irrelevantTagIds: body.irrelevantTagIds ?? [],
                    planetFactorOverrides: body.planetFactorOverrides ?? {},
                });
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [horoscopeId]);

    // Keepalive flush on unmount / page hide / visibility loss.
    useEffect(() => {
        const flushKeepalive = () => {
            void flush(true);
        };
        window.addEventListener("beforeunload", flushKeepalive);
        document.addEventListener("visibilitychange", flushKeepalive);
        return () => {
            window.removeEventListener("beforeunload", flushKeepalive);
            document.removeEventListener("visibilitychange", flushKeepalive);
            void flush(true);
        };
    }, [flush]);

    const isOpen = doc.notepadState?.isOpen === true;
    const geometry = doc.notepadState ?? defaultGeometry();
    const hasContent = doc.observationTags.length > 0 || doc.resultNotes.length > 0;

    // --- selection -----------------------------------------------------------

    const selectParent = (parentTag: number | null) => {
        applyAndSchedule((current) => ({
            ...current,
            notepadState: {
                ...(current.notepadState ?? defaultGeometry()),
                selectedParentTag: parentTag ?? undefined,
                selectedSubTag: parentTag === null || parentTag === 0 ? undefined : null,
            },
        }));
    };

    const selectSubTag = (subTag: string | null) => {
        applyAndSchedule((current) => ({
            ...current,
            notepadState: {
                ...(current.notepadState ?? defaultGeometry()),
                selectedParentTag: current.notepadState?.selectedParentTag,
                selectedSubTag: subTag,
            },
        }));
    };

    // --- geometry ------------------------------------------------------------

    const applyGeometry = (
        mutate: (state: NonNullable<NoteDoc["notepadState"]>) => {
            position: { x: number; y: number };
            size: { width: number; height: number };
        },
    ) => {
        applyAndSchedule((current) => {
            const base = clampGeometry(current.notepadState ?? defaultGeometry());
            return { ...current, notepadState: { ...base, ...mutate(base) } };
        });
    };

    const handlePointerMove = (event: React.PointerEvent) => {
        if (dragging && dragOffset) {
            event.preventDefault();
            applyGeometry((state) => ({
                position: {
                    x: clamp(
                        event.clientX - dragOffset.dx,
                        DOCK_MARGIN,
                        Math.max(DOCK_MARGIN, window.innerWidth - state.size.width - DOCK_MARGIN),
                    ),
                    y: clamp(
                        event.clientY - dragOffset.dy,
                        DOCK_MARGIN,
                        Math.max(DOCK_MARGIN, window.innerHeight - state.size.height - DOCK_MARGIN),
                    ),
                },
                size: state.size,
            }));
        } else if (resizing) {
            event.preventDefault();
            applyGeometry((state) => ({
                position: state.position,
                size: {
                    width: clamp(
                        event.clientX - resizing.x + state.size.width,
                        NOTEPAD_MIN_WIDTH,
                        Math.min(NOTEPAD_MAX_WIDTH, window.innerWidth - DOCK_MARGIN),
                    ),
                    height: clamp(
                        event.clientY - resizing.y + state.size.height,
                        NOTEPAD_MIN_HEIGHT,
                        Math.min(NOTEPAD_MAX_HEIGHT, window.innerHeight - DOCK_MARGIN),
                    ),
                },
            }));
        }
    };

    const stopDragResize = () => {
        setDragging(null);
        setResizing(null);
        setDragOffset(null);
        void flush();
    };

    const handleDialogKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            applyAndSchedule((current) => ({
                ...current,
                notepadState: { ...(current.notepadState ?? defaultGeometry()), isOpen: false },
            }));
            buttonRef.current?.focus();
            return;
        }
        if (event.ctrlKey && event.altKey && event.key.startsWith("Arrow")) {
            event.preventDefault();
            const arrow = event.key.replace("Arrow", "");
            const delta = event.shiftKey ? RESIZE_STEP : NUDGE_STEP;
            if (event.shiftKey) {
                applyGeometry((state) => ({
                    position: state.position,
                    size: {
                        width: clamp(
                            state.size.width + (arrow === "Right" ? delta : arrow === "Left" ? -delta : 0),
                            NOTEPAD_MIN_WIDTH,
                            Math.min(NOTEPAD_MAX_WIDTH, window.innerWidth - DOCK_MARGIN),
                        ),
                        height: clamp(
                            state.size.height + (arrow === "Down" ? delta : arrow === "Up" ? -delta : 0),
                            NOTEPAD_MIN_HEIGHT,
                            Math.min(NOTEPAD_MAX_HEIGHT, window.innerHeight - DOCK_MARGIN),
                        ),
                    },
                }));
            } else {
                applyGeometry((state) => ({
                    position: {
                        x: clamp(
                            state.position.x + (arrow === "Right" ? delta : arrow === "Left" ? -delta : 0),
                            DOCK_MARGIN,
                            Math.max(DOCK_MARGIN, window.innerWidth - state.size.width - DOCK_MARGIN),
                        ),
                        y: clamp(
                            state.position.y + (arrow === "Down" ? delta : arrow === "Up" ? -delta : 0),
                            DOCK_MARGIN,
                            Math.max(DOCK_MARGIN, window.innerHeight - state.size.height - DOCK_MARGIN),
                        ),
                    },
                    size: state.size,
                }));
            }
        }
    };

    const openNotepad = () => {
        applyAndSchedule((current) => ({
            ...current,
            notepadState: { ...clampGeometry(current.notepadState ?? defaultGeometry()), isOpen: true },
        }));
        requestAnimationFrame(() => containerRef.current?.focus());
    };

    const closeNotepad = () => {
        applyAndSchedule((current) => ({
            ...current,
            notepadState: { ...(current.notepadState ?? defaultGeometry()), isOpen: false },
        }));
        buttonRef.current?.focus();
    };

    const resetPosition = () => {
        const fresh = defaultGeometry();
        applyAndSchedule((current) => {
            const base = current.notepadState ?? fresh;
            return {
                ...current,
                notepadState: {
                    ...base,
                    position: fresh.position,
                    size: {
                        width: Math.min(base.size.width, fresh.size.width),
                        height: Math.min(base.size.height, fresh.size.height),
                    },
                },
            };
        });
    };

    // --- student tag / note mutations ---------------------------------------

    const addTag = (tag: ObservationTag) => {
        applyAndSchedule((current) => ({ ...current, observationTags: [...current.observationTags, tag] }));
    };

    const updateTag = (id: string, updates: { text: string; color: number }) => {
        const now = new Date().toISOString();
        applyAndSchedule((current) => ({
            ...current,
            observationTags: current.observationTags.map((tag) =>
                tag.id === id ? { ...tag, ...updates, updatedAt: now } : tag,
            ),
        }));
    };

    const deleteTag = (id: string) => {
        applyAndSchedule((current) => ({
            ...current,
            observationTags: current.observationTags.filter((tag) => tag.id !== id),
        }));
    };

    const overrideTagColor = (tagId: string, color: string) => {
        applyAndSchedule((current) => ({
            ...current,
            observationTagOverrides: { ...current.observationTagOverrides, [tagId]: color },
        }));
    };

    const toggleIrrelevantTag = (tagId: string) => {
        applyAndSchedule((current) => ({
            ...current,
            irrelevantTagIds: current.irrelevantTagIds.includes(tagId)
                ? current.irrelevantTagIds.filter((id) => id !== tagId)
                : [...current.irrelevantTagIds, tagId],
        }));
    };

    /** Record a student determination of a planet factor's classification (TODO #26). The stored
     *  colour is always the effective one (the cycle replaces the derived value). */
    const overridePlanetFactor = (planet: number, factor: string, color: string) => {
        const planetKey = String(planet);
        applyAndSchedule((current) => ({
            ...current,
            planetFactorOverrides: {
                ...current.planetFactorOverrides,
                [planetKey]: {
                    ...current.planetFactorOverrides[planetKey],
                    [factor]: color,
                },
            },
        }));
    };

    const togglePlanetPanel = (planet: number) => {
        setExpandedPlanet((current) => (current === planet ? null : planet));
    };

    const addNote = (note: ResultNote) => {
        applyAndSchedule((current) => ({ ...current, resultNotes: [...current.resultNotes, note] }));
    };

    const updateNote = (id: string, text: string) => {
        const now = new Date().toISOString();
        applyAndSchedule((current) => ({
            ...current,
            resultNotes: current.resultNotes.map((note) => (note.id === id ? { ...note, text, updatedAt: now } : note)),
        }));
    };

    const deleteNote = (id: string) => {
        applyAndSchedule((current) => ({
            ...current,
            resultNotes: current.resultNotes.filter((note) => note.id !== id),
        }));
    };

    // Restore a stale sub-tag to parent-only (UX Q5 — never crash, never block).
    const selectedParentTag = doc.notepadState?.selectedParentTag ?? null;
    let selectedSubTag = doc.notepadState?.selectedSubTag ?? null;
    if (
        selectedSubTag !== null &&
        (selectedParentTag === null ||
            selectedParentTag === 0 ||
            !housePurposeEntryFor(selectedParentTag)?.subTags.includes(selectedSubTag))
    ) {
        selectedSubTag = null;
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={isOpen ? closeNotepad : openNotepad}
                aria-label={t("notepad.button")}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                title={hasContent ? t("notepad.hasContent") : t("notepad.button")}
                className={`relative w-8 h-8 flex items-center justify-center border rounded transition-colors ${
                    isOpen ? "bg-indigo-100 text-indigo-600 border-indigo-200" : "hover:bg-gray-50 text-gray-600"
                }`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {hasContent && !isOpen && (
                    <span
                        aria-hidden
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white"
                    />
                )}
            </button>

            {isOpen && (
                <div
                    ref={containerRef}
                    role="dialog"
                    aria-modal="false"
                    aria-label={t("notepad.title")}
                    tabIndex={-1}
                    onKeyDown={handleDialogKeyDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDragResize}
                    className="fixed z-40 flex flex-col bg-white border border-gray-200 rounded-lg shadow-xl outline-none"
                    style={{
                        top: geometry.position.y,
                        left: geometry.position.x,
                        width: geometry.size.width,
                        height: geometry.size.height,
                    }}
                >
                    <div
                        role="presentation"
                        title={t("notepad.dragHandle")}
                        onPointerDown={(event) => {
                            setDragging({ x: event.clientX, y: event.clientY });
                            setDragOffset({
                                dx: event.clientX - geometry.position.x,
                                dy: event.clientY - geometry.position.y,
                            });
                        }}
                        className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 cursor-move touch-none select-none"
                        style={{ minHeight: 44 }}
                    >
                        <h2 className="text-sm font-semibold text-gray-800 flex-1">{t("notepad.title")}</h2>
                        <button
                            type="button"
                            aria-label={t("notepad.resetPosition")}
                            title={t("notepad.resetPosition")}
                            onClick={resetPosition}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-3.5 h-3.5"
                            >
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            aria-label={t("notepad.close")}
                            onClick={closeNotepad}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>

                    <NotepadPlanetStrengths
                        calculatedDetails={calculatedDetails}
                        overrides={doc.planetFactorOverrides}
                        onOverrideFactor={overridePlanetFactor}
                        expandedPlanet={expandedPlanet}
                        onTogglePlanet={togglePlanetPanel}
                    />

                    <NotepadTagStrip
                        selectedParentTag={selectedParentTag}
                        selectedSubTag={selectedSubTag}
                        onSelectParent={selectParent}
                        onSelectSubTag={selectSubTag}
                    />

                    <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        <NotepadObservations
                            calculatedDetails={calculatedDetails}
                            parentTag={selectedParentTag}
                            subTag={selectedSubTag}
                            overrides={doc.observationTagOverrides}
                            onOverrideColor={overrideTagColor}
                            irrelevantTagIds={doc.irrelevantTagIds}
                            onToggleIrrelevant={toggleIrrelevantTag}
                            planetFactorOverrides={doc.planetFactorOverrides}
                            onOverridePlanetFactor={overridePlanetFactor}
                        />
                        {loading ? (
                            <div aria-busy="true" className="animate-pulse space-y-2">
                                <div className="h-3 w-24 bg-gray-200 rounded" />
                                <div className="h-8 bg-gray-200 rounded" />
                            </div>
                        ) : (
                            <NotepadStudentTags
                                tags={doc.observationTags}
                                selectedParentTag={selectedParentTag}
                                selectedSubTag={selectedSubTag}
                                onAdd={addTag}
                                onUpdate={(id, updates) => updateTag(id, updates)}
                                onDelete={deleteTag}
                            />
                        )}
                        {!loading && (
                            <NotepadResultNotes
                                notes={doc.resultNotes}
                                onAdd={addNote}
                                onUpdate={updateNote}
                                onDelete={deleteNote}
                            />
                        )}
                    </div>

                    <div
                        role="presentation"
                        title={t("notepad.resizeHandle")}
                        onPointerDown={(event) => {
                            setResizing({ x: event.clientX, y: event.clientY });
                        }}
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize touch-none"
                        style={{ padding: 8 }}
                    />
                </div>
            )}

            {saveFailed && (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-xs px-3 py-2 rounded shadow-lg"
                >
                    {t("notepad.toast.saveFailed")}
                </div>
            )}
        </>
    );
}
