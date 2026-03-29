import fs from "fs";
import path from "path";
import os from "os";

/**
 * 尝试探测 OpenClaw 数据目录的所有候选路径（按优先级排序）。
 * 解决以下常见问题：
 *  - OPENCLAW_HOME 被设成了没有点的路径（openclaw 而非 .openclaw）
 *  - 安装器写入了非标准路径
 *  - 环境变量指向旧目录
 */
function buildHomeCandidates(): string[] {
  const home = os.homedir();
  const appData = process.env.APPDATA || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates: (string | undefined)[] = [];

  // 1. 当前 OPENCLAW_HOME（可能有问题，但还是先试）
  const envHome = (process.env.OPENCLAW_HOME || "").trim();
  if (envHome) candidates.push(envHome);

  // 2. 标准默认路径
  candidates.push(path.join(home, ".openclaw"));

  // 3. 有些安装器/脚本会漏掉点
  candidates.push(path.join(home, "openclaw"));

  // 4. Windows 上的 AppData 变种
  if (appData) {
    candidates.push(path.join(appData, ".openclaw"));
    candidates.push(path.join(appData, "openclaw"));
  }
  if (localAppData) {
    candidates.push(path.join(localAppData, ".openclaw"));
    candidates.push(path.join(localAppData, "openclaw"));
  }

  // 5. macOS/Linux 常见安装路径
  candidates.push(path.join(home, "Library", "Application Support", ".openclaw"));
  candidates.push(path.join(home, "Library", "Application Support", "openclaw"));
  candidates.push(path.join(home, ".config", "openclaw"));
  candidates.push("/etc/openclaw");

  // 去重、去空
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of candidates) {
    if (!c) continue;
    const norm = c.trim();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(norm);
    }
  }
  return result;
}

let _detectedHome: string | null | undefined = undefined; // undefined = not yet tried

/**
 * 遍历候选路径，返回第一个包含 openclaw.json 的目录。
 * 结果缓存到进程内（只探测一次）。
 * 如果找到了与当前 OPENCLAW_HOME 不同的路径，会自动修正 process.env.OPENCLAW_HOME。
 *
 * @returns 有效的 openclaw home 路径，或 null（真的找不到）
 */
export function detectAndFixOpenclawHome(): string | null {
  if (_detectedHome !== undefined) return _detectedHome;

  const candidates = buildHomeCandidates();
  for (const candidate of candidates) {
    const configPath = path.join(candidate, "openclaw.json");
    try {
      if (fs.existsSync(configPath)) {
        _detectedHome = candidate;
        // 如果与当前 env 不一致，修正（对本进程后续调用生效）
        const current = (process.env.OPENCLAW_HOME || "").trim();
        if (current !== candidate) {
          process.env.OPENCLAW_HOME = candidate;
          console.log(
            `[ONE Claw] Auto-fixed OPENCLAW_HOME: "${current || "(not set)"}" → "${candidate}"`,
          );
        }
        return candidate;
      }
    } catch {
      /* 访问失败跳过 */
    }
  }

  _detectedHome = null;
  return null;
}

/** 重置缓存（测试 / 热重载用） */
export function resetOpenclawHomeCache(): void {
  _detectedHome = undefined;
}

/**
 * 根据当前（可能已修正的）OPENCLAW_HOME 计算实时路径。
 * 优先使用 detectAndFixOpenclawHome() 的结果，保证即使 env 被改变也能拿到正确路径。
 */
export function getResolvedOpenclawHome(): string {
  const detected = detectAndFixOpenclawHome();
  if (detected) return detected;
  // 找不到就还是用默认（保持原有行为）
  return process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
}

export function getResolvedConfigPath(): string {
  return path.join(getResolvedOpenclawHome(), "openclaw.json");
}
