import type { Metadata } from "next";

export const metadata: Metadata = {
    title: { default: "කේන්දර — Horoscopes", template: "%s | Kendara" },
    description:
        "ප්‍රසිද්ධ පුද්ගලයන්ගේ කේන්දර: උපන් දිනය, උපන් වේලාව, උපන් ස්ථානය, ලග්නය, නවාංශකය, යෝග සහ දශා. Public Vedic horoscopes with birth time, birth place, yogas and dashas.",
    alternates: { canonical: "/horoscopes" },
};

export default function HoroscopesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
