import { spawn } from "child_process";
import { resolveOpenclawExecutable, resolveOpenclawMjsPath } from "@/lib/openclaw-cli";
import { enforceLocalRequest } from "@/lib/api-local-guard";

export async function POST(req: Request) {
  const guard = enforceLocalRequest(req, "Doctor API");
  if (guard) return guard;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const mjs = resolveOpenclawMjsPath();
      const command = mjs ? process.execPath : resolveOpenclawExecutable();
      const args = mjs ? [mjs, "doctor", "--fix"] : ["doctor", "--fix"];
      const lower = command.toLowerCase();

      const child = spawn(command, args, {
        shell: process.platform === "win32" && (lower.endsWith(".cmd") || lower.endsWith(".bat")),
        windowsHide: true,
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      const decode = (buf: Buffer): string => {
        if (buf.length > 2 && buf[1] === 0) return buf.toString("utf16le");
        return buf.toString("utf8");
      };
      child.stdout.on("data", (buf: Buffer) => controller.enqueue(encoder.encode(decode(buf))));
      child.stderr.on("data", (buf: Buffer) => controller.enqueue(encoder.encode(`[stderr] ${decode(buf)}`)));
      child.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n[error] ${err.message}\n[exit_code] 1\n`));
        controller.close();
      });
      child.on("close", (code) => {
        controller.enqueue(encoder.encode(`\n[exit_code] ${code ?? 1}\n`));
        controller.close();
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

