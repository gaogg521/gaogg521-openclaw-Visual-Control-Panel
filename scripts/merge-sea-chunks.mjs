/**
 * Merge lib/locales/sea/chunk-*.mjs (arrays of [ms, id, th] in en-keys order) into ms.json, id.json, th.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import c0 from "../lib/locales/sea/chunk-0.mjs";
import c1 from "../lib/locales/sea/chunk-1.mjs";
import c2 from "../lib/locales/sea/chunk-2.mjs";
import c3 from "../lib/locales/sea/chunk-3.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const enPath = path.join(root, "lib/locales/en-keys.json");

const pairs = JSON.parse(fs.readFileSync(enPath, "utf8"));
const rows = [...c0, ...c1, ...c2, ...c3];
if (rows.length !== pairs.length) {
  throw new Error(`sea rows ${rows.length} !== en-keys ${pairs.length}`);
}

const ms = {};
const id = {};
const th = {};
pairs.forEach((p, i) => {
  const triple = rows[i];
  if (!Array.isArray(triple) || triple.length !== 3) {
    throw new Error(`Bad triple at index ${i}`);
  }
  ms[p.key] = triple[0];
  id[p.key] = triple[1];
  th[p.key] = triple[2];
});

fs.writeFileSync(path.join(root, "lib/locales/ms.json"), JSON.stringify(ms, null, 2), "utf8");
fs.writeFileSync(path.join(root, "lib/locales/id.json"), JSON.stringify(id, null, 2), "utf8");
fs.writeFileSync(path.join(root, "lib/locales/th.json"), JSON.stringify(th, null, 2), "utf8");
console.log("Wrote ms/id/th.json", Object.keys(ms).length, "keys");
