# SEO

- Public Horoscopes are main sharable and marketing item of this system. 
- Some popular public horoscopes are not modifing anymore. So such horoscopes should possible to do static rendering. 
- How to find such horoscope? Such horoscope has Metadata for SEO tags. Super admin can see the metadata tags, and he can add metadata. 
    - Users are normally search 
        Mahinda Rajapaksha Kendaraya
        Mahinda Rajapaksha birth time
        Mahinda Rajapaksha birth location
        Mahinda Rajapaksha Horoscope
        Mahinda Rajapaksha Darmakarmadipathi Yogaya
        etc...
- Other pages should server side rendaring. 
- All pages should optimised for SEO. 
- If some user share a public horoscope it should render the birth chart image and navansaka image in App like Facebook. 
- If you have any suggetions for SEO this tell me. 
- I need to cache horoscope pages in browser. Is it affect for SEO? 
## Implementation notes

- **Rendering.** `/horoscopes/[id]` is a server page (`src/app/horoscopes/[id]/page.tsx`). It renders the guest view of a public horoscope with the full chart, tables and yogas as HTML. The interactive client view is `src/components/horoscopeView/HoroscopeView.tsx`. Signed-in viewers get their own copy (owner names, navigation) after the page loads.
- **"Static" rendering.** The locale comes from the `NEXT_LOCALE` cookie, so pages can't be pre-built as fixed HTML files. Instead, the public view data of **every** public horoscope is cached on the server (`src/lib/horoscopeView.ts`, `unstable_cache` with the tags `horoscope:<id>` and `horoscopes`).
  - Every save route clears that cache (`src/lib/revalidate.ts`). Save routes are: edit, privacy, manual chart, shad bala, metadata, the admin routes, SEO and recalculation.
  - Popular horoscopes are therefore served from the cache with no database query. Edits show up immediately.
  - For search engines this is the same as static HTML.
- **SEO data (super admin).** Open the **Metadata** tab on a horoscope. You can set a title, a description, **alias URLs** and "show in search engines".
  - Each alias redirects (308 permanent redirect): `/horoscopes/mahinda`, `/horoscopes/mr` and `/horoscopes/mahinda-rajapaksha` all go to `/horoscopes/<id>`.
  - Without overrides, the title is `<name> කේන්දරය | Kendara`. The description is generated from the birth date, time, place and lagna.
- **Tags on every public horoscope.** `<title>`, meta description, `canonical`, `robots`, Open Graph (`og:type=profile`, `og:locale=si_LK`), Twitter card, `fb:app_id`, and JSON-LD (`WebPage` about a `Person` with `birthDate` and `birthPlace`, plus a `BreadcrumbList`).
- **Facebook / WhatsApp preview.** There are two `og:image` tags: the birth chart (D1) first, then the Navamsa (D9). Both are 840×840 PNGs. Share links (`/share/<token>`) carry the same preview but are `noindex`.
- **Other pages.**
  - `/sitemap.xml` lists public, indexable horoscopes.
  - `/robots.txt` allows the chart image URLs and blocks the rest of `/api`.
  - `admin`, `settings`, `signin`, `locations`, `horoscopes/new` and `horoscopes/[id]/edit` are `noindex`.
- **Production.** Set `NEXT_PUBLIC_APP_URL` to the public https origin. Canonical URLs, `og:image` and the sitemap are built from it. After deploying, test a horoscope URL in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and submit `/sitemap.xml` in Google Search Console.

## Does browser caching affect SEO?

No. Googlebot doesn't use your users' browser cache. Faster pages are a small ranking plus.

- **HTML pages** are not cached long in the browser. They depend on the sign-in session and the locale cookie, and the server cache already makes them fast.
- **Chart images** carry a version in the URL (`?v=<render time>`), so they are cached as `immutable` for a year. A recalculated chart gets a new URL, so browsers and Facebook pick up the new image. Facebook keeps old previews for weeks, and the new URL is what makes it fetch again. To refresh an existing post straight away, use "Scrape Again" in the Sharing Debugger.
- **Requests without the version** keep a 5-minute cache. Private horoscopes always use `private` (never shared caches).

## Later

- **Locale in the URL** (`/en/...`, `/si/...` with `hreflang`), so English pages can be indexed too. Today crawlers only see Sinhala.
- **Server-render the `/horoscopes` list and the dashboard.** They still load their data in the browser. They do have titles and descriptions.
