import { archivedTdsActionWorkflows } from "@/lib/workflows/tds-reporting";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { actionItems } from "@/db/schema";
import { eq, desc, and, notInArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowSlug = searchParams.get("workflow");
    const completedFilter = searchParams.get("completed");

    const filters = [notInArray(actionItems.workflowSlug, archivedTdsActionWorkflows)];
    if (workflowSlug) filters.push(eq(actionItems.workflowSlug, workflowSlug));
    if (completedFilter !== null) filters.push(eq(actionItems.completed, completedFilter === "true"));
    const items = await db.select().from(actionItems).where(and(...filters))
      .orderBy(desc(actionItems.createdAt));
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
      .where(and(eq(actionItems.id, id), notInArray(actionItems.workflowSlug, archivedTdsActionWorkflows)))
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
