"use client";

import { useState } from "react";
import { IconSidebar } from "./icon-sidebar";
import { ChatPanel } from "./chat-panel";
import { TopBar } from "./top-bar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isChatOpen, setIsChatOpen] = useState(true);

  return (
    <div className="flex h-full">
      <IconSidebar
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        isChatOpen={isChatOpen}
      />
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <ScrollArea className="flex-1">
          <main className="p-6">{children}</main>
        </ScrollArea>
      </div>
    </div>
  );
}
