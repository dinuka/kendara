/** @jest-environment jsdom */
/**
 * The running Dasha period opens automatically, down to its Prana rows, on phones and desktop —
 * including real trees, which are stored only down to Sukshama (Prana is derived on demand).
 */
import DashaSection from "@/components/Dasha/DashaSection";

import type { Dashas } from "@/lib/astrology";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

jest.mock("@/hooks/useI18n", () => {
    const t = Object.assign((key: string) => key, { has: () => false });
    return { useI18n: () => ({ t, locale: "en", setLocale: () => {} }) };
});

const DAY = 86_400_000;
/** Local "YYYY-MM-DD", the format the calculation stores. */
const iso = (offsetDays: number) => {
    const d = new Date(Date.now() + offsetDays * DAY);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Two periods per level: one finished, one running now (index 1). */
function pair<T>(make: (start: string, end: string) => T, span: number): T[] {
    return [make(iso(-3 * span), iso(-span)), make(iso(-span), iso(span))];
}

const prana = (startDate: string, endDate: string) => ({ planet: 1, startDate, endDate, durationHours: 5, startAge: 30 });
let storedPrana = true;
const sukshama = (startDate: string, endDate: string) => ({
    planet: 2, startDate, endDate, durationDays: 4, startAge: 30, prana: storedPrana ? pair(prana, 1) : [],
});
const vidasa = (startDate: string, endDate: string) => ({
    planet: 3, startDate, endDate, durationDays: 20, startAge: 30, sukshama: pair(sukshama, 5),
});
const antardasha = (startDate: string, endDate: string) => ({
    planet: 4, startDate, endDate, durationMonths: 6, startAge: 30, vidasa: pair(vidasa, 40),
});
const mahadasha = (startDate: string, endDate: string) => ({
    planet: 5, startDate, endDate, durationYears: 6, remainingYearsAtBirth: 0, startAge: 30,
    antardasha: pair(antardasha, 200),
});

const buildDashas = (withPrana: boolean) => {
    storedPrana = withPrana;
    return {
        mahadasha: pair(mahadasha, 1000),
        currentPeriod: {
            mahadashaLord: 5,
            antardashaLord: 4,
            vidasaLord: 3,
            sukshamaLord: 2,
            pranaLord: withPrana ? 1 : null,
        },
    } as unknown as Dashas;
};

function setViewport(phone: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: phone,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
}

function renderSection(dashas: Dashas) {
    return render(
        <DashaSection
            dashas={dashas}
            getPlanetName={(id) => `P${id}`}
            getDashaLevelName={(level) => level}
            getSignName={(id) => `S${id}`}
            planets={[]}
            lagnaSign={1}
            showNakshatraNumbers={false}
            planetTags={{}}
        />,
    );
}

const ACTIVE_PATHS = ["md:1", "md:1/ad:1", "md:1/ad:1/vd:1", "md:1/ad:1/vd:1/sk:1", "md:1/ad:1/vd:1/sk:1/pr:1"];

describe.each([
    ["phone", true],
    ["desktop", false],
])("Dasha auto-expand on %s", (_label, phone) => {
    beforeEach(() => setViewport(phone));

    it("opens the running period down to its Prana rows", () => {
        const { container } = renderSection(buildDashas(true));
        for (const path of ACTIVE_PATHS) {
            expect(container.querySelector(`[data-dasha-path="${path}"]`)).not.toBeNull();
        }
    });

    it("derives and opens Prana rows when the stored tree stops at Sukshama", () => {
        const { container } = renderSection(buildDashas(false));
        const sukshamaPath = ACTIVE_PATHS[3];
        const pranaRows = container.querySelectorAll(`[data-dasha-path^="${sukshamaPath}/pr:"]`);
        expect(pranaRows).toHaveLength(9);
        // Exactly one derived Prana is the running one, and the Current summary reaches Prana.
        expect(container.querySelectorAll(`[data-dasha-path^="${sukshamaPath}/pr:"][aria-current="true"]`)).toHaveLength(1);
        expect(container.textContent).toContain(" PR");
    });
});
