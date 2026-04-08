"use client";

import {
  StaggerContainer,
  StaggerItem,
} from "@/components/motion/page-transition";
import WorkflowCalendar from "@/components/dashboard/workflow-calendar";

export default function CalendarPage() {
  return (
    <StaggerContainer>
      <StaggerItem>
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upcoming and due workflow analyses
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        <WorkflowCalendar />
      </StaggerItem>
    </StaggerContainer>
  );
}
