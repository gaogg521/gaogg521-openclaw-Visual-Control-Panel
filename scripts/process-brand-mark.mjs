/**
 * 将 PNG 转为侧栏用品牌图：近白底变透明、裁边、限制最大高度。
 * 用法: node scripts/process-brand-mark.mjs <输入.png> [输出.png]
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const srcArg = process.argv[2] || path.join(process.env.USERPROFILE || "", ".openclaw", "ROO", "12.png");
const destArg = process.argv[3] || path.join(root, "public", "brand-mark.png");

if (!fs.existsSync(srcArg)) {
  console.error("Missing input:", srcArg);
  process.exit(1);
}

const MAX_H = 56;
const WHITE = 248;

const { data, info } = await sharp(srcArg)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const w = info.width;
const h = info.height;
const ch = info.channels;
if (ch !== 4) {
  console.error("Expected RGBA after ensureAlpha");
  process.exit(1);
}

const out = Buffer.from(data);
for (let i = 0; i < out.length; i += 4) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  if (r >= WHITE && g >= WHITE && b >= WHITE) {
    out[i + 3] = 0;
  }
}

await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .trim({ threshold: 0 })
  .resize({
    height: MAX_H,
    fit: "inside",
    withoutEnlargement: false,
    kernel: sharp.kernel.lanczos3,
  })
  .png({ compressionLevel: 9 })
  .toFile(destArg);

const meta = await sharp(destArg).metadata();
console.log("[brand-mark]", srcArg, "->", destArg, `${meta.width}x${meta.height}`);
