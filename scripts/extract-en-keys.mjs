import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const s = fs.readFileSync(path.join(__dirname, "../lib/i18n.tsx"), "utf8");
const start = s.indexOf("  en: {");
const sub = s.slice(start);
const end = sub.indexOf("\n  },\n};");
const block = sub.slice(0, end);
const re = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/gs;
const keys = [];
let m;
while ((m = re.exec(block))) {
  keys.push({ key: m[1], value: m[2].replace(/\\n/g, "\n").replace(/\\"/g, '"') });
}
const outPath = process.argv[2];
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(keys, null, 2), "utf8");
  console.log("wrote", keys.length, "keys to", outPath);
} else {
  console.log(JSON.stringify(keys, null, 0));
  console.error("count", keys.length);
}
