import { NextResponse } from "next/server";

const MMC_BASE = "https://mmc-ridership-summaries.vercel.app";

export async function GET() {
  try {
    const res = await fetch(`${MMC_BASE}/api/months`, {
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
      { error: err instanceof Error ? err.message : "Failed to fetch months" },
      { status: 502 },
    );
  }
}
