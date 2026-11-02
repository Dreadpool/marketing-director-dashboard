"use client";

import { IconSidebar } from "./icon-sidebar";
import { TopBar } from "./top-bar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {

  return (
    <div className="flex h-full">
      <IconSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <ScrollArea className="flex-1">
          <main className="p-6">{children}</main>
        </ScrollArea>
      </div>
    </div>
  );
}
