import { NextRequest, NextResponse } from "next/server";

const MMC_BASE = "https://mmc-ridership-summaries.vercel.app";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return NextResponse.json({ error: "month parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${MMC_BASE}/api/report?month=${encodeURIComponent(month)}`, {
      next: { revalidate: 0 },
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
      { error: err instanceof Error ? err.message : "Failed to fetch report" },
      { status: 502 },
    );
  }
}
