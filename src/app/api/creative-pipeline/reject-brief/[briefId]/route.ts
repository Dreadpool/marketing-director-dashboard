import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const MIN_REASON_LENGTH = 10;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ briefId: string }> }
) {
  try {
    const { briefId } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = (body.reason ?? '').trim();

    if (reason.length < MIN_REASON_LENGTH) {
      return NextResponse.json(
        { error: `reason must be at least ${MIN_REASON_LENGTH} characters` },
        { status: 400 }
      );
    }

    const now = new Date();
    const result = await db
      .update(creativeBriefs)
      .set({
        status: 'rejected-at-review',
        killReason: reason,
        rejectedAt: now,
        updatedAt: now,
      })
      .where(and(eq(creativeBriefs.briefId, briefId), eq(creativeBriefs.status, 'proposed')));

    const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (rowCount === 0) {
      return NextResponse.json(
        { error: 'brief not found or not in proposed status' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      briefId,
      status: 'rejected-at-review',
      kill_reason: reason,
      rejected_at: now.toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
