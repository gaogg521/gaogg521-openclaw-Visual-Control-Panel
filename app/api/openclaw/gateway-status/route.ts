import { NextResponse } from "next/server";
import { execOpenclaw } from "@/lib/openclaw-cli";

export async function POST() {
  try {
    const { stdout, stderr } = await execOpenclaw(["gateway", "status"]);
    return NextResponse.json({
      ok: true,
      command: "openclaw gateway status",
      stdout,
      stderr,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        command: "openclaw gateway status",
        error: err?.message || "gateway status failed",
        stdout: typeof err?.stdout === "string" ? err.stdout : "",
        stderr: typeof err?.stderr === "string" ? err.stderr : "",
      },
      { status: 500 },
    );
  }
}

