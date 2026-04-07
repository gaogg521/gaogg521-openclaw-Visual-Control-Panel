/**
 * After `next build` with output: standalone, copy static + public into .next/standalone
 * (same as Dockerfile / packaging README).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js — run npm run build first.");
  process.exit(1);
}

fs.mkdirSync(path.join(standalone, ".next"), { recursive: true });
fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });

const scriptsDest = path.join(standalone, "scripts");
const addPathScriptSrc = path.join(
  root,
  "packaging",
  "openclaw-oneclick",
  "scripts",
  "add-openclaw-windows-path.ps1",
);
if (fs.existsSync(addPathScriptSrc)) {
  fs.mkdirSync(scriptsDest, { recursive: true });
  fs.copyFileSync(addPathScriptSrc, path.join(scriptsDest, "add-openclaw-windows-path.ps1"));
}

console.log("[packaging] Copied .next/static and public into .next/standalone");
