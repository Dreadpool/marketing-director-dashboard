import { NextRequest, NextResponse } from "next/server";

export function checkInterviewApiAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.MD_DASHBOARD_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "MD_DASHBOARD_API_KEY not configured on server" },
      { status: 500 },
    );
  }
  const got = req.headers.get("authorization");
  if (got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
