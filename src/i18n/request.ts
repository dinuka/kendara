import en from "@/messages/en.json";
import si from "@/messages/si.json";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const locales = ["en", "si"];
const messagesMap = { en, si };

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!locale || !locales.includes(locale as "en" | "si")) {
        const cookieStore = await cookies();
        const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
        locale = locales.includes(cookieLocale || "") ? cookieLocale : "si";
    }

    return {
        locale: locale as "en" | "si",
        messages: messagesMap[locale as "en" | "si"] || messagesMap.si,
    };
});
