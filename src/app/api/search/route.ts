import { NextResponse } from "next/server";
import { requireProfile, searchPortal } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const profile = await requireProfile();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const results = await searchPortal(profile, q.slice(0, 100));
    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Search failed" }, { status: 500 });
  }
}
