import { NextResponse } from "next/server";
import { getMemoryInventory } from "@/lib/memory-inventory";

export async function GET() {
  try {
    const data = getMemoryInventory();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "inventory failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
