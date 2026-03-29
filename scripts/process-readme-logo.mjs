/**
 * readme-logo: remove white margins + dark brown panel → transparent PNG, resize for README.
 * Run: node scripts/process-readme-logo.mjs
 */
import sharp from "sharp";
import fs from "fs";

const input = "docs/readme-logo.png";
const tmp = "docs/readme-logo.new.png";
const output = "docs/readme-logo.png";

if (!fs.existsSync(input)) {
  console.error("Missing", input);
  process.exit(1);
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const stride = 4;

function getPixel(x, y) {
  const i = (y * w + x) * stride;
  return [data[i], data[i + 1], data[i + 2]];
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Dark “panel” pixels in left/right margins (banner layout)
const darkSamples = [];
const margin = 2;
const xMax = Math.max(margin + 1, Math.floor(w * 0.22));
for (let x = margin; x < xMax; x++) {
  for (let y = margin; y < h - margin; y++) {
    const [r, g, b] = getPixel(x, y);
    if (lum(r, g, b) >= 12 && lum(r, g, b) < 100) darkSamples.push([r, g, b]);
  }
}
for (let x = w - xMax; x < w - margin; x++) {
  for (let y = margin; y < h - margin; y++) {
    const [r, g, b] = getPixel(x, y);
    if (lum(r, g, b) >= 12 && lum(r, g, b) < 100) darkSamples.push([r, g, b]);
  }
}

let br = 40,
  bg = 30,
  bb = 25;
if (darkSamples.length >= 8) {
  br = Math.round(darkSamples.reduce((s, p) => s + p[0], 0) / darkSamples.length);
  bg = Math.round(darkSamples.reduce((s, p) => s + p[1], 0) / darkSamples.length);
  bb = Math.round(darkSamples.reduce((s, p) => s + p[2], 0) / darkSamples.length);
}

const whiteTol = 42;
const brownTol = 58;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const dWhite = Math.hypot(r - 255, g - 255, b - 255);
  const dBrown = Math.hypot(r - br, g - bg, b - bb);
  if (dWhite < whiteTol || dBrown < brownTol) data[i + 3] = 0;
}

const targetH = 44;
const outW = Math.max(1, Math.round((w * targetH) / h));

await sharp(Buffer.from(data), {
  raw: { width: w, height: h, channels: 4 },
})
  .resize({ height: targetH, width: outW, fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile(tmp);

try {
  fs.unlinkSync(output);
} catch {
  /* ignore */
}
fs.renameSync(tmp, output);
console.log("Wrote", output, `${outW}x${targetH}`, "brown≈", br, bg, bb, "samples", darkSamples.length);
