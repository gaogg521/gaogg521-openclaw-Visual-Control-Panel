/**
 * 生产重启：强制结束占用 3003 的进程，再以 PORT=3003 拉起 standalone。
 * npm run restart
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const killScript = path.join(__dirname, "kill-port.mjs");
const startScript = path.join(__dirname, "start-prod.mjs");

const FIXED_PORT = "3003";

const r1 = spawnSync(process.execPath, [killScript, FIXED_PORT], {
  cwd: root,
  stdio: "inherit",
});
if (r1.status !== 0 && r1.status !== null) {
  process.exit(r1.status ?? 1);
}

if (!fs.existsSync(path.join(root, ".next", "standalone", "server.js"))) {
  console.error("[restart] 缺少 .next/standalone/server.js，请先执行: npm run build");
  process.exit(1);
}

const env = { ...process.env, PORT: FIXED_PORT, HOSTNAME: process.env.HOSTNAME || "0.0.0.0" };
const r2 = spawnSync(process.execPath, [startScript], {
  cwd: root,
  env,
  stdio: "inherit",
});
process.exit(r2.status ?? 0);
