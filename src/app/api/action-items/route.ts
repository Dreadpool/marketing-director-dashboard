import { NextResponse } from "next/server";
import { db } from "@/db";
import { actionItems } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowSlug = searchParams.get("workflow");
    const completedFilter = searchParams.get("completed");

    let query = db.select().from(actionItems).orderBy(desc(actionItems.createdAt));

    if (workflowSlug) {
      query = query.where(eq(actionItems.workflowSlug, workflowSlug)) as typeof query;
    }

    if (completedFilter !== null) {
      const isCompleted = completedFilter === "true";
      query = query.where(eq(actionItems.completed, isCompleted)) as typeof query;
    }

    const items = await query;
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Failed to fetch action items:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch action items",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, completed } = await request.json();

    if (!id || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "id and completed (boolean) are required" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(actionItems)
      .set({
        completed,
        completedAt: completed ? new Date() : null,
      })
      .where(eq(actionItems.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Action item not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update action item:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update action item",
      },
      { status: 500 },
    );
  }
}
