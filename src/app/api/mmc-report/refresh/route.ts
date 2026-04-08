import { NextRequest, NextResponse } from "next/server";

const MMC_BASE = "https://mmc-ridership-summaries.vercel.app";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return NextResponse.json({ error: "month parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${MMC_BASE}/api/report/refresh?month=${encodeURIComponent(month)}`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body.error || `MMC API returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh report" },
      { status: 502 },
    );
  }
}
