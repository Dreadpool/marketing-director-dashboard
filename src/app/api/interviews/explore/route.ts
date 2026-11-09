import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "New interviews are closed." }, { status: 410 });
}
