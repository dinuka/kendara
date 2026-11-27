import { Resvg } from "@resvg/resvg-js";
import path from "path";

/** Bundled fonts (SIL OFL, see assets/fonts/OFL.txt). Servers usually have no Sinhala or zodiac-glyph
 *  fonts installed, so the rasterizer must never fall back to system fonts. */
const FONT_FILES = ["NotoSans.ttf", "NotoSansSinhala.ttf", "NotoSansSymbols.ttf", "NotoSansSymbols2.ttf"].map((f) =>
    path.join(process.cwd(), "assets", "fonts", f),
);

/** Rasterizes a chart SVG to PNG at 2x for sharp previews on high-DPI screens. */
export const svgToPng = (svg: string): Buffer =>
    new Resvg(svg, {
        fitTo: { mode: "zoom", value: 2 },
        background: "#ffffff",
        font: {
            loadSystemFonts: false,
            fontFiles: FONT_FILES,
            defaultFontFamily: "Noto Sans",
            sansSerifFamily: "Noto Sans",
        },
    })
        .render()
        .asPng();
