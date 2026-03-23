import { NextResponse } from "next/server";
import { listOpenclawSkills } from "@/lib/openclaw-skills";

export async function GET() {
  try {
    return NextResponse.json(listOpenclawSkills());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
