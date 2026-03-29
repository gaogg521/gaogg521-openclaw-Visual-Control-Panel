/**
 * 结束占用指定 TCP 端口的监听进程（默认 3003）。
 * Windows: netstat + taskkill；macOS/Linux: lsof + kill
 *
 * 用法：node scripts/kill-port.mjs [port]
 * 或：PORT=3004 node scripts/kill-port.mjs
 */
import { execSync } from "child_process";
import os from "os";

const port = String(process.argv[2] || process.env.PORT || "3003").trim();
if (!/^\d+$/.test(port)) {
  console.error("[kill-port] Invalid port:", port);
  process.exit(1);
}

const platform = os.platform();

function killWindows() {
  let out;
  try {
    out = execSync("netstat -ano", { encoding: "utf-8" });
  } catch {
    console.error("[kill-port] netstat failed");
    process.exit(1);
  }
  const needle = `:${port}`;
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes(needle) || !/LISTENING/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (/^\d+$/.test(pid)) pids.add(pid);
  }
  if (pids.size === 0) {
    console.log(`[kill-port] No LISTENING process on port ${port}`);
    return;
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
      console.log(`[kill-port] Killed PID ${pid} (port ${port})`);
    } catch {
      console.warn(`[kill-port] Could not kill PID ${pid} (may need admin or already exited)`);
    }
  }
}

function killUnix() {
  let out;
  try {
    out = execSync(`lsof -ti :${port}`, { encoding: "utf-8" });
  } catch (e) {
    const st = e && typeof e === "object" && "status" in e ? e.status : null;
    if (st === 1) {
      console.log(`[kill-port] No process on port ${port}`);
      return;
    }
    console.error("[kill-port] lsof failed (install lsof or use manual kill):", e?.message || e);
    process.exit(1);
  }
  const pids = [...new Set(out.trim().split(/\n/).filter(Boolean))];
  for (const pid of pids) {
    try {
      process.kill(parseInt(pid, 10), "SIGTERM");
      console.log(`[kill-port] Sent SIGTERM to PID ${pid} (port ${port})`);
    } catch (e) {
      console.warn(`[kill-port] PID ${pid}:`, e?.message || e);
    }
  }
}

if (platform === "win32") {
  killWindows();
} else {
  killUnix();
}
