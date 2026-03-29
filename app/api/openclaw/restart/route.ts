import { spawn } from "child_process";
import { resolveOpenclawExecutable, resolveOpenclawMjsPath } from "@/lib/openclaw-cli";
import { probeGatewayChatReachable } from "@/lib/gateway-reachability";
import { enforceLocalRequest } from "@/lib/api-local-guard";

/** openclaw gateway restart 在健康检查等待上常固定 60s 超时，但 Gateway 实际已可访问 /chat */
function looksLikeGatewayRestartHealthTimeout(combinedOutput: string): boolean {
  const t = combinedOutput.toLowerCase();
  return (
    /timed out.*health|health check.*timed|waiting for health|gateway restart timed/i.test(t) ||
    /60s.*health|health.*60s/i.test(t)
  );
}

export async function POST(req: Request) {
  const guard = enforceLocalRequest(req, "OpenClaw restart API");
  if (guard) return guard;

  const encoder = new TextEncoder();
  const MAX_ACC = 512 * 1024;
  let accumulated = "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const mjs = resolveOpenclawMjsPath();
      const command = mjs ? process.execPath : resolveOpenclawExecutable();
      const args = mjs ? [mjs, "gateway", "restart"] : ["gateway", "restart"];
      const lower = command.toLowerCase();

      const child = spawn(command, args, {
        shell: process.platform === "win32" && (lower.endsWith(".cmd") || lower.endsWith(".bat")),
        windowsHide: true,
        // 与 CMD 一致：不强制关颜色；stdout/stderr 合并转发（控制台本就是一屏混排）
        env: { ...process.env },
      });

      const decode = (buf: Buffer): string => {
        if (buf.length > 2 && buf[1] === 0) return buf.toString("utf16le");
        return buf.toString("utf8");
      };

      const bump = (s: string) => {
        if (accumulated.length >= MAX_ACC) return;
        accumulated += s;
        if (accumulated.length > MAX_ACC) accumulated = accumulated.slice(0, MAX_ACC);
      };

      const pushChunk = (raw: Buffer) => {
        const t = decode(raw);
        bump(t);
        controller.enqueue(encoder.encode(t));
      };

      child.stdout.on("data", pushChunk);
      child.stderr.on("data", pushChunk);
      child.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n[error] ${err.message}\n[exit_code] 1\n`));
        controller.close();
      });
      child.on("close", (code) => {
        void (async () => {
          try {
            const c = code ?? 1;
            let effective = c;
            if (c !== 0) {
              const timeoutLikely = looksLikeGatewayRestartHealthTimeout(accumulated);
              if (timeoutLikely && (await probeGatewayChatReachable(12000))) {
                controller.enqueue(
                  encoder.encode(
                    `\n[note] Gateway 已可访问：CLI 在等待健康检查时退出（常见），可几秒后刷新页面再试。\n`,
                  ),
                );
                effective = 0;
              }
            }
            controller.enqueue(encoder.encode(`\n[exit_code] ${effective}\n`));
          } catch (e) {
            controller.enqueue(
              encoder.encode(
                `\n[error] ${e instanceof Error ? e.message : String(e)}\n[exit_code] ${code ?? 1}\n`,
              ),
            );
          } finally {
            controller.close();
          }
        })();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
