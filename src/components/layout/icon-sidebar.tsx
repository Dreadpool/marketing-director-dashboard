"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  CheckSquare,
  CalendarDays,
  Settings,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
}

interface IconSidebarProps {
  onToggleChat: () => void;
  isChatOpen: boolean;
}

export function IconSidebar({ onToggleChat, isChatOpen }: IconSidebarProps) {
  const pathname = usePathname();

  const topItems: SidebarItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: GitBranch, label: "Workflows", href: "/workflows" },
    { icon: CheckSquare, label: "Action Items", href: "/action-items" },
    { icon: CalendarDays, label: "Calendar", href: "/calendar" },
  ];

  const bottomItems: SidebarItem[] = [
    {
      icon: MessageSquare,
      label: isChatOpen ? "Hide Chat" : "Show Chat",
      onClick: onToggleChat,
    },
    { icon: Settings, label: "Settings", href: "/settings/data-sources" },
  ];

  return (
    <div className="flex h-full w-12 flex-col items-center border-r border-border bg-surface py-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href="/"
              className="mb-4 flex h-8 w-8 items-center justify-center rounded-md bg-gold text-gold-foreground transition-transform hover:scale-105"
            />
          }
        >
          <Sparkles className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Marketing Director</TooltipContent>
      </Tooltip>

      <div className="flex flex-1 flex-col items-center gap-1">
        {topItems.map((item) => (
          <SidebarIcon
            key={item.label}
            item={item}
            isActive={
              item.href === "/"
                ? pathname === "/"
                : item.href
                  ? pathname.startsWith(item.href)
                  : false
            }
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1">
        {bottomItems.map((item) => (
          <SidebarIcon
            key={item.label}
            item={item}
            isActive={item.label.includes("Hide")}
          />
        ))}
      </div>
    </div>
  );
}

function SidebarIcon({
  item,
  isActive,
}: {
  item: SidebarItem;
  isActive: boolean;
}) {
  const Icon = item.icon;
  const classes = cn(
    "flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200",
    isActive
      ? "bg-accent text-gold"
      : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

  const iconElement = <Icon className="h-4 w-4" />;

  if (item.href) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Link href={item.href} className={classes} />}>
          {iconElement}
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<button onClick={item.onClick} className={classes} />}
      >
        {iconElement}
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
