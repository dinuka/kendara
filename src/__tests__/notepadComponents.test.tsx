/** @jest-environment jsdom */
/**
 * Student Notepad — component tests (RTL + jsdom, per-file environment override per QA plan).
 * QA plan: specs/qa/20260816-1823-student-notes-test-plan.md (UI-SN-305, UI-SN-403/404,
 * UI-SN-500..506).
 *
 * The persistence pipeline (debounce / coalescing / optimistic UI / rollback / keepalive flush)
 * is exercised end-to-end through the Notepad component with faked timers and a stubbed fetch.
 */
import Notepad from "@/components/notepad/Notepad";

import { NOTEPAD_MAX_HEIGHT, NOTEPAD_MAX_WIDTH } from "@/lib/notepadCatalogs";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("@/hooks/useI18n", () => {
    const MESSAGES: Record<string, string> = {
        "notepad.button": "Student notepad",
        "notepad.title": "Student Notepad",
        "notepad.close": "Close notepad",
        "notepad.resetPosition": "Reset position",
        "notepad.dragHandle": "Drag to move",
        "notepad.resizeHandle": "Drag to resize",
        "notepad.toast.saveFailed": "Save failed — changes were not saved.",
        "notepad.aria.parentStrip": "House purposes",
        "notepad.aria.subTagStrip": "Sub-tags",
        "notepad.housePurpose.0.label": "Other",
        "notepad.studentTags.title": "My observations",
        "notepad.studentTags.overviewEmpty": "Select a house purpose above",
        "notepad.studentTags.add": "Add",
        "notepad.studentTags.addPlaceholder": "Add observation",
        "notepad.studentTags.edit": "Edit",
        "notepad.studentTags.delete": "Delete",
        "notepad.studentTags.limitReached": "Tag limit reached",
        "notepad.studentTags.charCount": "{count}/{max}",
        "notepad.resultNotes.title": "Result notes",
        "notepad.resultNotes.empty": "No notes yet",
        "notepad.resultNotes.add": "Save note",
        "notepad.resultNotes.addPlaceholder": "Write a result note…",
        "notepad.resultNotes.edit": "Edit",
        "notepad.resultNotes.delete": "Delete",
        "notepad.resultNotes.limitReached": "Note limit reached",
        "notepad.tagColors.1": "White",
        "notepad.tagColors.2": "Light red",
        "notepad.tagColors.3": "Dark red",
        "notepad.tagColors.4": "Light green",
        "notepad.tagColors.5": "Dark green",
        "notepad.tagColors.6": "Yellow",
        "notepad.housePurpose.subTags.marriage": "Marriage",
        "notepad.hint": "Select a house purpose to see system observations",
        "notepad.observation.planetsInHouse": "Planets in this house",
        "notepad.observation.markNotRelevant": "Mark as not relevant",
        "notepad.observation.restoreTag": "Restore as relevant",
        "notepad.observation.notRelevant": "not relevant",
        "notepad.observation.classification.green": "good",
        "notepad.observation.classification.red": "bad",
        "notepad.observation.classification.white": "neutral",
        "notepad.observation.classification.lightGreen": "good",
        "notepad.observation.classification.darkGreen": "good",
        "notepad.observation.classification.lightRed": "bad",
        "notepad.observation.classification.darkRed": "bad",
        "notepad.planetStrengths.title": "Planet strengths",
        "notepad.planetStrengths.hint": "Click a planet to review its strength factors",
        "notepad.planetStrengths.factors.sign": "Sign dignity",
        "notepad.planetStrengths.factors.signLabel": "{strength} in {sign}",
        "notepad.planetStrengths.factors.navamsa": "Navamsa dignity",
        "notepad.planetStrengths.factors.navamsaLabel": "{strength} in {sign}",
        "notepad.planetStrengths.factors.house": "House {house}",
        "notepad.planetStrengths.factors.dig": "Dig Bala",
        "notepad.planetStrengths.factors.kala": "Kala Bala",
        "notepad.planetStrengths.factors.cheshta": "Cheshta Bala",
        "notepad.planetStrengths.factors.naisargika": "Naisargika Bala",
        "notepad.planetStrengths.factors.retrograde": "Retrograde",
        "notepad.planetStrengths.factors.combust": "Combust",
        "notepad.planetStrengths.factors.atmakaraka": "Atmakaraka",
        "notepad.planetStrengths.factors.yogakaraka": "Yogakaraka",
        "notepad.planetStrengths.factors.maranakaraka": "Maranakaraka",
        "notepad.planetStrengths.factors.maraka": "Maraka",
        "notepad.planetStrengths.factors.badhaka": "Badhaka",
        "notepad.planetStrengths.factors.wargoththama": "Wargoththama",
        "notepad.planetStrengths.factors.pushkara": "Pushkara",
        "notepad.planetStrengths.factors.gandantha": "Gandantha",
        "notepad.planetStrengths.factors.gandamula": "Gandamula",
        "notepad.planetStrengths.factors.ashtamansha": "Ashtamansha",
        "notepad.planetStrengths.factors.nidhanamsha": "Nidhanamsha",
        "notepad.aria.planetStrengths": "Planet strengths",
        "notepad.aria.planetFactor": "{factor} — {classification}",
        "astrology.planetNames.1": "Sun",
        "astrology.planetNames.2": "Moon",
        "astrology.planetNames.3": "Mars",
        "astrology.planetNames.6": "Venus",
        "astrology.signNames.2": "Taurus",
        "astrology.signNamesLocative.2": "Taurus",
        "astrology.signNamesLocative.7": "Libra",
        "astrology.strengthInSign.athiUchcha": "Deeply exalted",
        "astrology.strengthInSign.debilitated": "Debilitated",
        "astrology.strengthInSign.enemy": "Enemy",
    };
    for (let n = 1; n <= 12; n += 1) {
        MESSAGES[`notepad.housePurpose.${n}.label`] = `House ${n}`;
    }
    return {
        useI18n: () => ({
            locale: "en",
            setLocale: jest.fn(),
            t: (key: string, params?: Record<string, unknown>) => {
                let msg = MESSAGES[key] ?? key;
                if (params) {
                    for (const [k, v] of Object.entries(params)) {
                        msg = msg.replace(`{${k}}`, String(v));
                    }
                }
                return msg;
            },
        }),
    };
});

const SAVED_DOC = {
    notepadState: {
        position: { x: 120, y: 80 },
        size: { width: 480, height: 640 },
        isOpen: false,
        selectedParentTag: 7,
        selectedSubTag: "marriage",
    },
    observationTags: [] as never[],
    resultNotes: [] as never[],
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

const putCalls = () => mockFetch.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT");

const putBody = (index = 0) => {
    const [, init] = putCalls()[index] as [string, RequestInit];
    return JSON.parse(String(init.body)) as {
        notepadState?: { selectedParentTag?: number; selectedSubTag?: string | null; isOpen?: boolean };
        observationTags?: Array<{ id: string; color: number }>;
        observationTagOverrides?: Record<string, string>;
        irrelevantTagIds?: string[];
        planetFactorOverrides?: Record<string, Record<string, string>>;
    };
};

const flushMicrotasks = () =>
    act(async () => {
        await Promise.resolve();
    });

/** Renders the notepad with a saved doc and opens the popup. */
async function openNotepadWithSavedDoc() {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC });
    render(<Notepad horoscopeId="horo-1" calculatedDetails={null} />);
    await flushMicrotasks();
    fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
}

const parentChip = (n: number) => screen.getByRole("button", { name: `${n} — House ${n}` });

beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
});

afterEach(() => {
    jest.useRealTimers();
});

describe("UI-SN-305: reopen restores geometry + open-state + selection", () => {
    test("reopen restores position/size and the selected (parent, sub-tag)", async () => {
        await openNotepadWithSavedDoc();

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveStyle({ left: "120px", top: "80px", width: "480px", height: "640px" });
        expect(parentChip(7)).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Marriage" })).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", { name: "Close notepad" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
        const reopened = screen.getByRole("dialog");
        expect(reopened).toHaveStyle({ left: "120px", top: "80px", width: "480px", height: "640px" });
        expect(parentChip(7)).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Marriage" })).toHaveAttribute("aria-pressed", "true");
    });
});

describe("UI-SN-500/501: debounce + coalescing", () => {
    test("no PUT within 500ms; exactly one after a quiet period", async () => {
        await openNotepadWithSavedDoc();
        expect(putCalls()).toHaveLength(0);

        fireEvent.click(parentChip(2));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        await flushMicrotasks();
        expect(putCalls()).toHaveLength(0);

        act(() => {
            jest.advanceTimersByTime(100);
        });
        await flushMicrotasks();
        expect(putCalls()).toHaveLength(1);
        expect(putBody(0).notepadState?.selectedParentTag).toBe(2);
        expect(putBody(0).notepadState?.selectedSubTag).toBeNull();
    });

    test("rapid successive edits coalesce into one PUT with the final state", async () => {
        await openNotepadWithSavedDoc();

        for (const n of [2, 3, 4, 5, 6]) {
            fireEvent.click(parentChip(n));
            act(() => {
                jest.advanceTimersByTime(60);
            });
        }
        expect(putCalls()).toHaveLength(0);

        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        expect(putCalls()).toHaveLength(1);
        expect(putBody(0).notepadState?.selectedParentTag).toBe(6);
    });
});

describe("UI-SN-502: optimistic UI", () => {
    test("selection change reflects immediately, before the PUT resolves", async () => {
        await openNotepadWithSavedDoc();

        fireEvent.click(parentChip(2));
        expect(parentChip(2)).toHaveAttribute("aria-pressed", "true");
        expect(parentChip(7)).toHaveAttribute("aria-pressed", "false");
        expect(putCalls()).toHaveLength(0);

        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        expect(putCalls()).toHaveLength(1);
    });
});

describe("UI-SN-503: PUT failure → rollback + toast", () => {
    test("failed PUT reverts the UI and shows the error toast, which auto-hides", async () => {
        await openNotepadWithSavedDoc();

        // Let the open-state save confirm first — the "pre-change state" the UI must revert to.
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        expect(putCalls()).toHaveLength(1);

        // From here on, saves fail.
        mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

        fireEvent.click(parentChip(2));
        expect(parentChip(2)).toHaveAttribute("aria-pressed", "true");

        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(parentChip(7)).toHaveAttribute("aria-pressed", "true");
        expect(parentChip(2)).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("alert")).toHaveTextContent("Save failed");

        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});

describe("UI-SN-504/505: pending edits are flushed, not lost", () => {
    test("closing within the debounce window still saves (flush after close)", async () => {
        await openNotepadWithSavedDoc();

        fireEvent.click(parentChip(3));
        fireEvent.click(screen.getByRole("button", { name: "Close notepad" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        expect(putCalls()).toHaveLength(1);
        expect(putBody(0).notepadState?.selectedParentTag).toBe(3);
    });

    test("unmounting within the debounce window fires an immediate keepalive PUT", async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC });
        const { unmount } = render(<Notepad horoscopeId="horo-1" calculatedDetails={null} />);
        await flushMicrotasks();
        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));

        fireEvent.click(parentChip(4));
        expect(putCalls()).toHaveLength(0);

        act(() => {
            unmount();
        });
        expect(putCalls()).toHaveLength(1);
        expect(putCalls()[0][1]).toMatchObject({ keepalive: true });
        expect(putBody(0).notepadState?.selectedParentTag).toBe(4);
    });
});

describe("UI-SN-403/404: no-op clicks do not churn saves", () => {
    test("clicking the already-selected parent/sub-tag fires no additional PUT", async () => {
        await openNotepadWithSavedDoc();
        // Opening the popup persists isOpen (UI-SN-305) — flush that single save first.
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        const afterOpen = putCalls().length;
        expect(afterOpen).toBe(1);

        fireEvent.click(parentChip(7));
        fireEvent.click(screen.getByRole("button", { name: "Marriage" }));

        act(() => {
            jest.advanceTimersByTime(1000);
        });
        await flushMicrotasks();
        expect(putCalls()).toHaveLength(afterOpen);
    });
});

describe("Geometry bounds (UI-SN-303/304)", () => {
    test("notepad never exceeds the documented max size", async () => {
        await openNotepadWithSavedDoc();
        const dialog = screen.getByRole("dialog");
        expect(parseInt(dialog.style.width, 10)).toBeLessThanOrEqual(NOTEPAD_MAX_WIDTH);
        expect(parseInt(dialog.style.height, 10)).toBeLessThanOrEqual(NOTEPAD_MAX_HEIGHT);
    });
});

describe("UI-SN-506: click a tag to change its color (TODO #26)", () => {
    const SAVED_DOC_WITH_TAG = {
        ...SAVED_DOC,
        observationTags: [
            {
                id: "tag-1",
                parentTag: 7,
                subTag: "marriage",
                text: "Venus strong",
                color: 1,
                createdAt: "2026-08-16T10:00:00.000Z",
                updatedAt: "2026-08-16T10:00:00.000Z",
            },
        ],
    };

    test("clicking a student tag opens the palette; picking a color persists via PUT", async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC_WITH_TAG });
        render(<Notepad horoscopeId="horo-1" calculatedDetails={null} />);
        await flushMicrotasks();
        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
        // Flush the isOpen save.
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();

        fireEvent.click(screen.getByRole("button", { name: "Venus strong — White" }));
        const picker = screen.getByRole("radiogroup", { name: "Tag color" });
        expect(picker).toBeInTheDocument();

        fireEvent.click(within(picker).getByRole("radio", { name: "Dark red" }));
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();

        const last = putBody(putCalls().length - 1);
        expect(last.observationTags).toContainEqual(expect.objectContaining({ id: "tag-1", color: 3 }));
    });
});

describe("UI-SN-507: mark a system observation tag not relevant (TODO #26)", () => {
    const CALC_DETAILS = {
        ascendant: { sign: 1, degree: 0, lord: 3 },
        planets: [
            { name: 2, sign: 2, house: 7, strength: 1.25 },
            { name: 3, sign: 2, house: 7, strength: -1 },
        ],
    };

    const planetSection = () => {
        const heading = screen.getByRole("heading", { name: "Planets in this house" });
        return heading.closest("section") as HTMLElement;
    };

    async function openWithCalculations() {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC });
        render(<Notepad horoscopeId="horo-1" calculatedDetails={CALC_DETAILS} />);
        await flushMicrotasks();
        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
        // Flush the isOpen save.
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
    }

    test("clicking a tag → 'Mark as not relevant' toggles: strike-through, ratio drops, persisted via PUT", async () => {
        await openWithCalculations();
        expect(within(planetSection()).getByText("(1/2)")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Moon (good)" }));
        fireEvent.click(screen.getByRole("button", { name: "Mark as not relevant" }));

        expect(screen.getByRole("button", { name: "Moon (good) — not relevant" })).toHaveClass("line-through");
        expect(within(planetSection()).getByText("(0/1)")).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        const last = putBody(putCalls().length - 1);
        expect(last.irrelevantTagIds).toHaveLength(1);
        expect(last.irrelevantTagIds?.[0]).toContain("planetsInHouse:planet:2");
    });

    test("the same panel restores the tag — strike-through gone, ratio back, PUT clears the id", async () => {
        await openWithCalculations();
        fireEvent.click(screen.getByRole("button", { name: "Moon (good)" }));
        fireEvent.click(screen.getByRole("button", { name: "Mark as not relevant" }));
        expect(within(planetSection()).getByText("(0/1)")).toBeInTheDocument();

        // The strength panel stays open — restore directly from it.
        fireEvent.click(screen.getByRole("button", { name: "Restore as relevant" }));

        expect(screen.getByRole("button", { name: "Moon (good)" })).not.toHaveClass("line-through");
        expect(within(planetSection()).getByText("(1/2)")).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        const last = putBody(putCalls().length - 1);
        expect(last.irrelevantTagIds).toEqual([]);
    });
});

describe("UI-SN-508: planet-strength section + strength panel (TODO #26)", () => {
    const CALC_DETAILS = {
        ascendant: { sign: 1, degree: 0, lord: 3 },
        planets: [
            { name: 2, sign: 2, house: 7, strength: 1.25 },
            { name: 3, sign: 2, house: 7, strength: -1 },
        ],
    };

    async function openWithCalculations() {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC });
        render(<Notepad horoscopeId="horo-1" calculatedDetails={CALC_DETAILS} />);
        await flushMicrotasks();
        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
    }

    test("renders the planet section above the parent-tag strip with ratio chips", async () => {
        await openWithCalculations();
        const planetSection = screen.getByRole("region", { name: "Planet strengths" });
        const parentStrip = screen.getByRole("group", { name: "House purposes" });
        expect(planetSection.compareDocumentPosition(parentStrip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        // Moon: sign (green) + house 7 (green) → 2/2. Mars: sign (red) + house 7 (green) → 1/2.
        expect(screen.getByRole("button", { name: "Moon (2/2) — good" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mars (1/2) — neutral" })).toBeInTheDocument();
    });

    test("clicking a planet chip opens its factor panel; toggling a factor persists via PUT", async () => {
        await openWithCalculations();
        fireEvent.click(screen.getByRole("button", { name: "Moon (2/2) — good" }));
        expect(screen.getByRole("button", { name: "Deeply exalted in Taurus — good" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "House 7 — good" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "House 7 — good" }));
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        const last = putBody(putCalls().length - 1);
        expect(last.planetFactorOverrides).toEqual({ "2": { house: "red" } });
        // 1/2 (50%) → white band; the ratio on the chip drops.
        expect(screen.getByRole("button", { name: "Moon (1/2) — neutral" })).toBeInTheDocument();
    });

    test("planet chips in the observation sections show the ratio badge too", async () => {
        await openWithCalculations();
        const moonChip = screen.getByRole("button", { name: "Moon (good)" });
        expect(moonChip).toHaveTextContent("(2/2)");
        const marsChip = screen.getByRole("button", { name: "Mars (bad)" });
        expect(marsChip).toHaveTextContent("(1/2)");
    });

    test("an observation planet chip opens the same strength panel with the not-relevant footer", async () => {
        await openWithCalculations();
        fireEvent.click(screen.getByRole("button", { name: "Mars (bad)" }));
        expect(screen.getByRole("button", { name: "Debilitated in Taurus — bad" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mark as not relevant" })).toBeInTheDocument();
    });

    test("lost/absent factors emit no tag at all (no netha tags), ratio counts only shown tags", async () => {
        const withShadbalaya = {
            ascendant: { sign: 1, degree: 0, lord: 3 },
            planets: [{ name: 2, sign: 2, house: 7, strength: 1.25 }],
            shadbalaya: { "2": { digBala: { value: false }, cheshtaBala: { value: false } } },
        };
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC });
        render(<Notepad horoscopeId="horo-1" calculatedDetails={withShadbalaya} />);
        await flushMicrotasks();
        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();
        // Lost balas → no "No Dig Bala" / "No Cheshta Bala" tags, ratio stays 2/2.
        expect(screen.getByRole("button", { name: "Moon (2/2) — good" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Moon (2/2) — good" }));
        expect(screen.queryByRole("button", { name: /Bala/ })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Deeply exalted in Taurus — good" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "House 7 — good" })).toBeInTheDocument();
    });

    test("planet tags are separated from other tags in a section by a gap spacer", async () => {
        // Venus present so house 7's lord (Libra → Venus) produces a mixed houseLord section:
        // the Venus planet chip followed by its lordDetail tags.
        const withVenus = {
            ascendant: { sign: 1, degree: 0, lord: 3 },
            planets: [
                { name: 2, sign: 2, house: 7, strength: 1.25 },
                { name: 3, sign: 2, house: 7, strength: -1 },
                { name: 6, sign: 7, house: 7, strength: 1.25 },
            ],
        };
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC });
        render(<Notepad horoscopeId="horo-1" calculatedDetails={withVenus} />);
        await flushMicrotasks();
        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();

        const section = screen.getByRole("region", { name: "notepad.observation.houseLord" });
        const chips = within(section).getAllByRole("button");
        expect(chips.length).toBeGreaterThan(1);
        expect(chips[0]).toHaveAccessibleName(/Venus/);
        // The planet-tag group (Venus) is separated from its detail tags by an aria-hidden gap.
        const spacer = section.querySelector("span[aria-hidden='true'].w-3");
        expect(spacer).toBeInTheDocument();
        expect(spacer && spacer.compareDocumentPosition(chips[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    test("sign/navamsa factor chips show the strength-in-sign meaning; an open panel is gapped from the other planets", async () => {
        // Sun in Libra (debilitated, red), navamsa in Taurus (enemy, red), house 1 kendra (green) → 1/3.
        const withSun = {
            ascendant: { sign: 1, degree: 0, lord: 3 },
            planets: [{ name: 1, sign: 7, house: 1, strength: -1, navamsaSign: 2, navamsaStrength: -0.1 }],
        };
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => SAVED_DOC });
        render(<Notepad horoscopeId="horo-1" calculatedDetails={withSun} />);
        await flushMicrotasks();
        fireEvent.click(screen.getByRole("button", { name: "Student notepad" }));
        act(() => {
            jest.advanceTimersByTime(500);
        });
        await flushMicrotasks();

        fireEvent.click(screen.getByRole("button", { name: "Sun (1/3) — bad" }));
        expect(screen.getByRole("button", { name: "Debilitated in Libra — bad" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Enemy in Taurus — bad" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "House 1 — good" })).toBeInTheDocument();

        // The panel sits below its chip with a bottom gap so it reads as separate from the other planets.
        const panel = screen.getByRole("group", { name: "Sun — Planet strengths" });
        expect(panel).toHaveClass("mb-2");
    });
});
