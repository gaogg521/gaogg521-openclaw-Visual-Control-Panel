import { NextResponse } from "next/server";
import { execSync } from "child_process";

// 24 小时内存缓存
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 从 git remote URL 提取 GitHub 用户名 */
function getGitHubUsername(): string | null {
  try {
    const url = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    const sshMatch = url.match(/github\.com[:/]([^/]+)\//);
    if (sshMatch) return sshMatch[1];
    const httpsMatch = url.match(/github\.com\/([^/]+)\//);
    if (httpsMatch) return httpsMatch[1];
  } catch {}
  return null;
}

// data-level 转近似 count
const LEVEL_TO_COUNT = [0, 2, 5, 8, 12];

async function fetchContributions(username: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`https://github.com/users/${username}/contributions`, {
      signal: controller.signal,
      headers: { Accept: "text/html" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();

    // 用正则提取所有 data-date + data-level
    const cellRe = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
    const days: { date: string; count: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = cellRe.exec(html)) !== null) {
      const level = Math.min(Number(m[2]), 4);
      days.push({ date: m[1], count: LEVEL_TO_COUNT[level] });
    }
    if (days.length === 0) return null;

    // 按日期排序后分组为 52 周
    days.sort((a, b) => a.date.localeCompare(b.date));
    const weeks: { days: { count: number; date: string }[] }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      while (chunk.length < 7) chunk.push({ count: 0, date: "" });
      weeks.push({ days: chunk });
    }
    // 保留最近 52 周
    const trimmed = weeks.slice(-52);
    while (trimmed.length < 52) {
      trimmed.unshift({ days: Array.from({ length: 7 }, () => ({ count: 0, date: "" })) });
    }
    return { weeks: trimmed, username };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const username = getGitHubUsername();
  if (!username) {
    return NextResponse.json({ error: "no github username" }, { status: 404 });
  }

  const data = await fetchContributions(username);
  if (!data) {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }

  cache = { data, ts: Date.now() };
  return NextResponse.json(data);
}
