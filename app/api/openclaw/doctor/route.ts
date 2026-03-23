import { NextResponse } from "next/server";
import { execOpenclaw } from "@/lib/openclaw-cli";

export async function POST() {
  try {
    const { stdout, stderr } = await execOpenclaw(["doctor", "--fix"]);
    return NextResponse.json({
      ok: true,
      command: "openclaw doctor --fix",
      stdout,
      stderr,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        command: "openclaw doctor --fix",
        error: err?.message || "doctor failed",
        stdout: typeof err?.stdout === "string" ? err.stdout : "",
        stderr: typeof err?.stderr === "string" ? err.stderr : "",
      },
      { status: 500 },
    );
  }
}

