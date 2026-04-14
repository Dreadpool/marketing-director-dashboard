import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version: "2026-04-14-creatives-mom",
    timestamp: new Date().toISOString(),
  });
}
