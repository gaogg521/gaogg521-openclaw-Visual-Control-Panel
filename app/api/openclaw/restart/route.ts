import { NextResponse } from "next/server";
import { execOpenclaw } from "@/lib/openclaw-cli";

export async function POST() {
  try {
    const { stdout, stderr } = await execOpenclaw(["gateway", "restart"]);

    return NextResponse.json({
      ok: true,
      command: "openclaw gateway restart",
      message: "OneOneClaw restart command executed.",
      stdout,
      stderr,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        command: "openclaw gateway restart",
        error: err?.message || "重启失败",
        stdout: typeof err?.stdout === "string" ? err.stdout : "",
        stderr: typeof err?.stderr === "string" ? err.stderr : "",
      },
      { status: 500 },
    );
  }
}

