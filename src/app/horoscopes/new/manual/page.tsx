"use client";

import ManualChartEditor from "@/components/ManualChart/ManualChartEditor";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewManualHoroscopePage() {
    const { status } = useSession();
    const router = useRouter();
    const { t } = useI18n();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/signin");
        }
    }, [status, router]);

    if (status === "loading" || status === "unauthenticated") {
        return <div className="w-full" aria-hidden="true" />;
    }

    return (
        <div className="w-full">
            <h1 className="text-2xl font-bold mb-6">{t("horoscope.addCalculated")}</h1>
            <ManualChartEditor mode="create" />
        </div>
    );
}
