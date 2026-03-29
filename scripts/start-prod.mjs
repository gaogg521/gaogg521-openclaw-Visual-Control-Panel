/**
 * next.config 使用 output: "standalone" 时，应启动 .next/standalone/server.js，
 * 而不是 next start（Next 会提示且不保证行为与资源路径正确）。
 *
 * 用法：npm run build 后执行 npm run start
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const serverJs = path.join(standaloneDir, "server.js");

if (!fs.existsSync(serverJs)) {
  console.error("[start] 未找到 .next/standalone/server.js，请先执行: npm run build");
  process.exit(1);
}

// 与 packaging 一致：保证 static / public 在 standalone 内可加载
try {
  execFileSync(process.execPath, [path.join(__dirname, "copy-standalone-assets.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}

const port = process.env.PORT || "3003";
const hostname = process.env.HOSTNAME || "0.0.0.0";

console.log(`[start] standalone server · PORT=${port} HOSTNAME=${hostname}`);

const child = spawn(process.execPath, ["server.js"], {
  cwd: standaloneDir,
  env: { ...process.env, PORT: port, HOSTNAME: hostname },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
