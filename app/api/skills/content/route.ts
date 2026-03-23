import { NextResponse } from "next/server";
import { getOpenclawSkillContent } from "@/lib/openclaw-skills";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = (searchParams.get("source") || "").trim();
    const id = (searchParams.get("id") || "").trim();

    if (!source || !id) {
      return NextResponse.json({ error: "Missing source or id" }, { status: 400 });
    }

    const result = getOpenclawSkillContent(source, id);
    if (!result) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: result.skill.id,
      name: result.skill.name,
      source: result.skill.source,
      content: result.content,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
