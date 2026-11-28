"use client";

import { useI18n } from "@/hooks/useI18n";

/** Student-only info banner explaining the settings are system-wide and managed by the admin
 *  (US-SAS-008). Never renders for super-admins — the Save affordance is their signal. */
export default function ManagedByAdminNotice() {
    const { t } = useI18n();
    return (
        <div
            role="status"
            className="flex items-start gap-3 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded p-3 text-sm"
        >
            <span aria-hidden="true" className="mt-0.5">
                ℹ
            </span>
            <p>
                <span className="font-semibold">{t("settings.system.managedByAdminTitle")}. </span>
                {t("settings.system.managedByAdminBody")}
            </p>
        </div>
    );
}
