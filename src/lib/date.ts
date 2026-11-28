import { format } from "date-fns";

const DISPLAY_DATE_FORMAT = "yyyy-MM-dd";

export function formatDate(date: Date | string | null | undefined): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    return format(d, DISPLAY_DATE_FORMAT);
}
