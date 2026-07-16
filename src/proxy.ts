import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VALID_LOCALES = ["en", "si"];
const DEFAULT_LOCALE = "si";

export function proxy(request: NextRequest) {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const locale = VALID_LOCALES.includes(cookieLocale || "") ? cookieLocale! : DEFAULT_LOCALE;

    const headers = new Headers(request.headers);
    headers.set("X-NEXT-INTL-LOCALE", locale);

    return NextResponse.next({ request: { headers } });
}

export const config = {
    matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
