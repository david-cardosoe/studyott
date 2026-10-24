// Renders the PWA and Apple touch icons from the brand mascot, using the
// Playwright Chromium already installed for e2e tests. Run `pnpm icons` after
// replacing public/brand/mascot.svg (or adding a logo) and commit the PNGs.
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const SOURCE = "public/brand/mascot.svg";
const BACKGROUND = "#f7f9f6";

// scale: how much of the square the mascot fills. Maskable icons keep it
// inside the central 80% safe zone; iOS adds no padding of its own.
const ICONS = [
  { file: "public/icons/icon-192.png", size: 192, scale: 0.8 },
  { file: "public/icons/icon-512.png", size: 512, scale: 0.8 },
  { file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.6 },
  { file: "app/apple-icon.png", size: 180, scale: 0.72 },
];

const svg = await readFile(SOURCE, "utf8");
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const browser = await chromium.launch();
try {
  for (const { file, size, scale } of ICONS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    const inner = Math.round(size * scale);
    await page.setContent(
      `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${BACKGROUND}">
        <img src="${dataUrl}" width="${inner}" height="${inner}">
      </body>`,
    );
    await page.screenshot({ path: file });
    await page.close();
    console.log(`wrote ${file}`);
  }
} finally {
  await browser.close();
}
